const DEFAULT_TEXT = '未知'
const XMODEM_PACKET_SIZE = 1024

export interface FirmwareMetadata {
	fileName: string
	firmwareType: string
	targetBoard: string
	firmwareVersion: string
	buildDate: string
}

export interface FirmwareImage {
	file: File
	bytes: Uint8Array
	size: number
	packetSize: number
	packetCount: number
	metadata: FirmwareMetadata
}

export function createEmptyFirmwareMetadata(): FirmwareMetadata {
	return {
		fileName: '未加载',
		firmwareType: DEFAULT_TEXT,
		targetBoard: DEFAULT_TEXT,
		firmwareVersion: DEFAULT_TEXT,
		buildDate: DEFAULT_TEXT,
	}
}

export async function loadFirmwareBinary(file: File): Promise<FirmwareImage> {
	const buffer = await file.arrayBuffer()
	const bytes = new Uint8Array(buffer)

	return {
		file,
		bytes,
		size: bytes.byteLength,
		packetSize: XMODEM_PACKET_SIZE,
		packetCount: Math.max(1, Math.ceil(bytes.byteLength / XMODEM_PACKET_SIZE)),
		metadata: inferFirmwareMetadata(file.name),
	}
}

export function inferFirmwareMetadata(fileName: string): FirmwareMetadata {
	const baseName = fileName.replace(/\.[^.]+$/, '')
	const tokens = baseName.split(/[\s._-]+/).filter(Boolean)

	const firmwareType = inferFirmwareType(baseName)
	const firmwareVersion = inferFirmwareVersion(baseName)
	const buildDate = inferBuildDate(baseName)
	const targetBoard = inferTargetBoard(tokens, firmwareType, firmwareVersion, buildDate)

	return {
		fileName,
		firmwareType,
		targetBoard,
		firmwareVersion,
		buildDate,
	}
}

function inferFirmwareType(baseName: string): string {
	const matched = /betaflight|inav|emuflight|blheli|lite|silver|custom|iap/i.exec(baseName)
	return matched?.[0] ?? DEFAULT_TEXT
}

function inferFirmwareVersion(baseName: string): string {
	const matched = /v?\d+\.\d+(?:\.\d+)?(?:[-+][a-z0-9]+)?/i.exec(baseName)
	return matched?.[0] ?? DEFAULT_TEXT
}

function inferBuildDate(baseName: string): string {
	const matched = /20\d{2}[.-]?\d{2}[.-]?\d{2}/.exec(baseName)
	if (!matched) return DEFAULT_TEXT

	const digits = matched[0].replace(/\D/g, '')
	if (digits.length !== 8) return matched[0]

	return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

function inferTargetBoard(
	tokens: string[],
	firmwareType: string,
	firmwareVersion: string,
	buildDate: string,
): string {
	const ignored = new Set([
		firmwareType.toLowerCase(),
		firmwareVersion.toLowerCase(),
		buildDate.toLowerCase(),
		'bin',
		'firmware',
		'release',
		'debug',
		'iap',
	])

	for (const token of tokens) {
		const normalized = token.toLowerCase()
		if (!normalized || ignored.has(normalized)) {
			continue
		}
		if (/^v?\d+$/.test(normalized)) {
			continue
		}
		if (/^20\d{6}$/.test(normalized)) {
			continue
		}
		return token
	}

	return DEFAULT_TEXT
}
