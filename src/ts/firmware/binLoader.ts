const DEFAULT_TEXT = '未知'
const XMODEM_PACKET_SIZE = 1024
const FIRMWARE_FOOTER_MAGIC = 0x5a
const FIRMWARE_FOOTER_FORMAT_VERSION = 0x01
const FIRMWARE_FOOTER_SIZE = 12

const TARGET_NAME_MAP: Record<number, string> = {
	1: 'Cetus_FC',
	2: 'Cetus_BL',
	6: 'Cetus_X',
	7: 'Cetus_X_HD',
	8: 'Aquila16_FC',
	9: 'Pavo20_Pocket',
	10: 'Aquila20_FC',
	11: 'Aquila16_V2_FC',
}

export interface FirmwareMetadata {
	fileName: string
	firmwareType: string
	targetBoard: string
	firmwareVersion: string
	buildDate: string
}

interface EmbeddedFirmwareFooter {
	targetId: number
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
	const rawBytes = new Uint8Array(buffer)
	const footer = parseEmbeddedFirmwareFooter(rawBytes)
	const bytes = footer ? rawBytes.slice(0, rawBytes.length - FIRMWARE_FOOTER_SIZE) : rawBytes

	return {
		file,
		bytes,
		size: bytes.byteLength,
		packetSize: XMODEM_PACKET_SIZE,
		packetCount: Math.max(1, Math.ceil(bytes.byteLength / XMODEM_PACKET_SIZE)),
		metadata: inferFirmwareMetadata(file.name, footer),
	}
}

export function inferFirmwareMetadata(fileName: string, footer?: EmbeddedFirmwareFooter | null): FirmwareMetadata {
	const baseName = fileName.replace(/\.[^.]+$/, '')
	const tokens = baseName.split(/[\s._-]+/).filter(Boolean)

	const firmwareType = inferFirmwareType(baseName)
	const firmwareVersion = footer?.firmwareVersion ?? inferFirmwareVersion(baseName)
	const buildDate = footer?.buildDate ?? inferBuildDate(baseName)
	const targetBoard = inferTargetBoard(tokens, firmwareType, firmwareVersion, buildDate)

	return {
		fileName,
		firmwareType,
		targetBoard: footer?.targetBoard ?? targetBoard,
		firmwareVersion,
		buildDate,
	}
}

function parseEmbeddedFirmwareFooter(bytes: Uint8Array): EmbeddedFirmwareFooter | null {
	if (bytes.length < FIRMWARE_FOOTER_SIZE) {
		return null
	}

	const footerStart = bytes.length - FIRMWARE_FOOTER_SIZE
	const footer = bytes.slice(footerStart)
	const magic = footer[0]
	const formatVersion = footer[1]
	const targetId = footer[2]
	const majorVersion = footer[3]
	const minorVersion = footer[4]
	const revisionVersion = footer[5]
	const yearPart1 = footer[6]
	const yearPart2 = footer[7]
	const yearPart3 = footer[8]
	const yearPart4 = footer[9]
	const month = footer[10]
	const day = footer[11]

	if (
		magic === undefined
		|| formatVersion === undefined
		|| targetId === undefined
		|| majorVersion === undefined
		|| minorVersion === undefined
		|| revisionVersion === undefined
		|| yearPart1 === undefined
		|| yearPart2 === undefined
		|| yearPart3 === undefined
		|| yearPart4 === undefined
		|| month === undefined
		|| day === undefined
	) {
		return null
	}

	const targetBoard = TARGET_NAME_MAP[targetId]

	if (magic !== FIRMWARE_FOOTER_MAGIC || formatVersion !== FIRMWARE_FOOTER_FORMAT_VERSION || !targetBoard) {
		return null
	}

	const buildYear = `${yearPart1}${yearPart2}${yearPart3}${yearPart4}`

	if (!isValidDateParts(buildYear, month, day)) {
		return null
	}

	return {
		targetId,
		targetBoard,
		firmwareVersion: `${majorVersion}.${minorVersion}.${revisionVersion}`,
		buildDate: `${buildYear}-${pad2(month)}-${pad2(day)}`,
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

function isValidDateParts(year: string, month: number, day: number): boolean {
	if (!/^20\d{2}$/.test(year)) {
		return false
	}

	if (month < 1 || month > 12 || day < 1 || day > 31) {
		return false
	}

	const date = new Date(Number(year), month - 1, day)
	return (
		date.getFullYear() === Number(year)
		&& date.getMonth() === month - 1
		&& date.getDate() === day
	)
}

function pad2(value: number): string {
	return value.toString().padStart(2, '0')
}
