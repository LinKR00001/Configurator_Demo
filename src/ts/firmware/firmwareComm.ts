import type { SerialConnectionEvent, SerialManager } from '@/composables/useSerial'
import type { FirmwareImage } from '@/ts/firmware/binLoader'

const XMODEM_STX = 0x02
const XMODEM_EOT = 0x04
const XMODEM_ACK = 0x06
const XMODEM_NAK = 0x15
const XMODEM_CAN = 0x18
const XMODEM_C = 0x43
const XMODEM_PACKET_SIZE = 1024
const XMODEM_PAD_BYTE = 0x1a

const BOOTLOADER_COMMAND = {
	main: 0x01,
	sensorV2: 0x03,
	osd: 0x05,
} as const

export type FirmwareFlashTarget = keyof typeof BOOTLOADER_COMMAND
export type FirmwareProtocolVersion = 'v1' | 'v2'

export interface FirmwareFlashProgress {
	stage: 'idle' | 'handshake' | 'transferring' | 'finalizing' | 'completed'
	message: string
	packetNumber: number
	totalPackets: number
	sentBytes: number
	totalBytes: number
	percent: number
}

export interface FirmwareFlashOptions {
	target?: FirmwareFlashTarget
	protocolVersion?: FirmwareProtocolVersion
	handshakeTimeoutMs?: number
	responseTimeoutMs?: number
	onProgress?: (progress: FirmwareFlashProgress) => void
	onLog?: (message: string) => void
	signal?: AbortSignal
}

export async function flashFirmwareImage(
	serialManager: SerialManager,
	image: FirmwareImage,
	options: FirmwareFlashOptions = {},
): Promise<void> {
	if (!serialManager.getConnected()) {
		throw new Error('串口未连接，无法开始烧写')
	}

	const target = resolveFlashTarget(image, options.target)
	const protocolVersion = options.protocolVersion ?? 'v2'
	const handshakeTimeoutMs = options.handshakeTimeoutMs ?? 5000
	const responseTimeoutMs = options.responseTimeoutMs ?? 2000
	const queue = new SerialByteQueue()
	const onData = (event: SerialConnectionEvent) => {
		if (event.data?.length) {
			queue.push(event.data)
		}
	}

	serialManager.addEventListener('data', onData)

	try {
		reportProgress(options, {
			stage: 'handshake',
			message: '正在进入 IAP 烧录模式',
			packetNumber: 0,
			totalPackets: image.packetCount,
			sentBytes: 0,
			totalBytes: image.size,
			percent: 0,
		})
		options.onLog?.(`当前烧录协议: ${protocolVersion.toUpperCase()}`)
		options.onLog?.(`发送 IAP 入口命令: 0x${BOOTLOADER_COMMAND[target].toString(16).toUpperCase()}`)

		const entered = await serialManager.send(new Uint8Array([BOOTLOADER_COMMAND[target]]))
		if (!entered) {
			throw new Error('发送 IAP 入口命令失败')
		}

		const handshakeStart = Date.now()
		const handshakeByte = await waitForControlByte(queue, [XMODEM_C], handshakeTimeoutMs, options.signal)
		const handshakeDuration = Date.now() - handshakeStart
		options.onLog?.(`收到握手字符: 0x${handshakeByte.toString(16).toUpperCase()} (${handshakeDuration}ms), IAP 已进入 XMODEM-1K CRC 接收状态`)

		for (let packetIndex = 0; packetIndex < image.packetCount; packetIndex++) {
			throwIfAborted(options.signal)

			const packetNumber = (packetIndex + 1) & 0xff
			const packet = buildDataPacket(packetNumber, slicePacketPayload(image.bytes, packetIndex), protocolVersion)

			reportProgress(options, {
				stage: 'transferring',
				message: `正在发送数据包 ${packetIndex + 1}/${image.packetCount}`,
				packetNumber: packetIndex + 1,
				totalPackets: image.packetCount,
				sentBytes: Math.min(packetIndex * XMODEM_PACKET_SIZE, image.size),
				totalBytes: image.size,
				percent: calculatePercent(packetIndex * XMODEM_PACKET_SIZE, image.size),
			})
			options.onLog?.(`发送数据包 #${packetIndex + 1}`)

			const sent = await serialManager.send(packet)
			if (!sent) {
				throw new Error(`数据包 #${packetIndex + 1} 发送失败`)
			}

			let acked = false
			while (!acked) {
				const response = await waitForControlByte(
					queue,
					[XMODEM_ACK, XMODEM_NAK, XMODEM_C, XMODEM_CAN],
					responseTimeoutMs,
					options.signal,
				)

				if (response === XMODEM_ACK) {
					acked = true
					options.onLog?.(`数据包 #${packetIndex + 1} 已确认`)
				} else if (response === XMODEM_CAN) {
					throw new Error('IAP 主动取消了本次升级')
				} else {
					options.onLog?.(`等待 ACK，收到 0x${response.toString(16).toUpperCase()}，继续等待`)
				}
			}
		}

		reportProgress(options, {
			stage: 'finalizing',
			message: '正在发送传输结束标记',
			packetNumber: image.packetCount,
			totalPackets: image.packetCount,
			sentBytes: image.size,
			totalBytes: image.size,
			percent: 100,
		})
		options.onLog?.('发送 EOT，等待设备复位')

		const eotSent = await serialManager.send(new Uint8Array([XMODEM_EOT]))
		if (!eotSent) {
			throw new Error('发送 EOT 失败')
		}

		await sleep(300)

		reportProgress(options, {
			stage: 'completed',
			message: '固件烧写完成，设备可能正在重启',
			packetNumber: image.packetCount,
			totalPackets: image.packetCount,
			sentBytes: image.size,
			totalBytes: image.size,
			percent: 100,
		})
	} finally {
		serialManager.removeEventListener('data', onData)
	}
}

class SerialByteQueue {
	private bytes: number[] = []
	private waiters: Array<{
		resolve: (value: number) => void
		reject: (reason?: unknown) => void
		timer: ReturnType<typeof setTimeout>
	}> = []

	push(chunk: Uint8Array): void {
		for (const byte of chunk) {
			const waiter = this.waiters.shift()
			if (waiter) {
				clearTimeout(waiter.timer)
				waiter.resolve(byte)
			} else {
				this.bytes.push(byte)
			}
		}
	}

	async readByte(timeoutMs: number, signal?: AbortSignal): Promise<number> {
		if (this.bytes.length > 0) {
			return this.bytes.shift()!
		}

		throwIfAborted(signal)

		return new Promise<number>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.waiters = this.waiters.filter((item) => item.reject !== reject)
				reject(new Error('等待 IAP 响应超时'))
			}, timeoutMs)

			const abortHandler = () => {
				clearTimeout(timer)
				this.waiters = this.waiters.filter((item) => item.reject !== reject)
				reject(new Error('烧写已取消'))
			}

			if (signal) {
				signal.addEventListener('abort', abortHandler, { once: true })
			}

			this.waiters.push({
				resolve: (value) => {
					if (signal) {
						signal.removeEventListener('abort', abortHandler)
					}
					resolve(value)
				},
				reject: (reason) => {
					if (signal) {
						signal.removeEventListener('abort', abortHandler)
					}
					reject(reason)
				},
				timer,
			})
		})
	}
}

function buildDataPacket(
	packetNumber: number,
	payload: Uint8Array,
	protocolVersion: FirmwareProtocolVersion,
): Uint8Array {
	const packet = new Uint8Array(3 + XMODEM_PACKET_SIZE + 2)
	packet[0] = XMODEM_STX
	packet[1] = packetNumber
	packet[2] = 0xff - packetNumber
	packet.set(payload, 3)

	const crc = crc16Ccitt(payload, protocolVersion)
	packet[3 + XMODEM_PACKET_SIZE] = (crc >> 8) & 0xff
	packet[3 + XMODEM_PACKET_SIZE + 1] = crc & 0xff
	return packet
}

function slicePacketPayload(bytes: Uint8Array, packetIndex: number): Uint8Array {
	const start = packetIndex * XMODEM_PACKET_SIZE
	const end = Math.min(start + XMODEM_PACKET_SIZE, bytes.length)
	const payload = new Uint8Array(XMODEM_PACKET_SIZE)
	payload.fill(XMODEM_PAD_BYTE)
	payload.set(bytes.slice(start, end))
	return payload
}

async function waitForControlByte(
	queue: SerialByteQueue,
	expected: number[],
	timeoutMs: number,
	signal?: AbortSignal,
): Promise<number> {
	while (true) {
		const byte = await queue.readByte(timeoutMs, signal)
		if (expected.includes(byte)) {
			return byte
		}
	}
}

function reportProgress(options: FirmwareFlashOptions, progress: FirmwareFlashProgress): void {
	options.onProgress?.(progress)
}

function calculatePercent(sentBytes: number, totalBytes: number): number {
	if (totalBytes <= 0) {
		return 0
	}
	return Math.max(0, Math.min(100, Math.round((sentBytes / totalBytes) * 100)))
}

function resolveFlashTarget(
	image: FirmwareImage,
	fallbackTarget?: FirmwareFlashTarget,
): FirmwareFlashTarget {
	switch (image.metadata.firmwareType) {
		case '飞控板':
			return 'main'
		case '传感器板':
			return 'sensorV2'
		case '图传板':
			return 'osd'
		default:
			return fallbackTarget ?? 'main'
	}
}

function crc16Ccitt(data: Uint8Array, protocolVersion: FirmwareProtocolVersion): number {
	let crc = 0
	const effectiveLength = protocolVersion === 'v1'
		? Math.max(0, data.length - 1)
		: data.length

	for (let i = 0; i < effectiveLength; i++) {
		const byte = data[i]!
		crc ^= byte << 8
		for (let bit = 0; bit < 8; bit++) {
			if ((crc & 0x8000) !== 0) {
				crc = ((crc << 1) ^ 0x1021) & 0xffff
			} else {
				crc = (crc << 1) & 0xffff
			}
		}
	}

	return crc & 0xffff
}

function throwIfAborted(signal?: AbortSignal): void {
	if (signal?.aborted) {
		throw new Error('烧写已取消')
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
