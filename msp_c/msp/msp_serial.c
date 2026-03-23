#include "msp_serial.h"
#include "crc.h"
#include "utils.h"
#include "streambuf.h"
#include "serial.h"
#include "string.h"

#include "drv_uart.h"

static mspPort_t mspPorts[MAX_MSP_PORT_COUNT]; // mspPort[0] -> displayport  mspPort[1] -> sensor_v2
serialPort_t serialPort[2];

static void resetMspPort(mspPort_t *mspPortToReset, serialPort_t *serialPort, bool sharedWithTelemetry)
{
    memset(mspPortToReset, 0, sizeof(mspPort_t));

    mspPortToReset->port = serialPort;
    mspPortToReset->sharedWithTelemetry = sharedWithTelemetry;
    mspPortToReset->descriptor = mspDescriptorAlloc();
}

void mspSerialAllocatePorts(void)
{
    /* displayport mspPorts[0] UART1 */
    mspPort_t *mspPort0 = &mspPorts[0];
    serialPort[0].identifier = SERIAL_PORT_UART1;
    resetMspPort(mspPort0, &serialPort[0], 0);

    /* sensor_v2 mspPorts[1] UART2 */
    mspPort_t *mspPort1 = &mspPorts[1];
    serialPort[1].identifier = SERIAL_PORT_UART2;
    resetMspPort(mspPort1, &serialPort[1], 1);
}

/**
  \brief 处理MSP包的内容
  */
static void mspSerialProcessReceivedPacketData(mspPort_t *mspPort, uint8_t c)
{
    switch (mspPort->packetState) {
        default:
        case MSP_IDLE:
        case MSP_HEADER_START:  // Waiting for 'M' (MSPv1 / MSPv2_over_v1) or 'X' (MSPv2 native)
            mspPort->offset = 0;
            mspPort->checksum1 = 0;
            mspPort->checksum2 = 0;
            switch (c) {
                case 'M':
                    mspPort->packetState = MSP_HEADER_M;
                    mspPort->mspVersion = MSP_V1;
                    break;
                case 'X':
                    mspPort->packetState = MSP_HEADER_X;
                    mspPort->mspVersion = MSP_V2_NATIVE;
                    break;
                default:
                    mspPort->packetState = MSP_IDLE;
                    break;
            }
            break;

        case MSP_HEADER_M:      // Waiting for '<' / '>'
            mspPort->packetState = MSP_HEADER_V1;
            switch (c) {
                case '<':
                    mspPort->packetType = MSP_PACKET_COMMAND;
                    break;
                case '>':
                    mspPort->packetType = MSP_PACKET_REPLY;
                    break;
                default:
                    mspPort->packetState = MSP_IDLE;
                    break;
            }
            break;

        case MSP_HEADER_X:
            mspPort->packetState = MSP_HEADER_V2_NATIVE;
            switch (c) {
                case '<':
                    mspPort->packetType = MSP_PACKET_COMMAND;
                    break;
                case '>':
                    mspPort->packetType = MSP_PACKET_REPLY;
                    break;
                default:
                    mspPort->packetState = MSP_IDLE;
                    break;
            }
            break;

        case MSP_HEADER_V1:     // Now receive v1 header (size/cmd), this is already checksummable
            mspPort->inBuf[mspPort->offset++] = c;
            mspPort->checksum1 ^= c;
            if (mspPort->offset == sizeof(mspHeaderV1_t)) {
                mspHeaderV1_t * hdr = (mspHeaderV1_t *)&mspPort->inBuf[0];
                // Check incoming buffer size limit
                if (hdr->size > MSP_PORT_INBUF_SIZE) {
                    mspPort->packetState = MSP_IDLE;
                }
                else if (hdr->cmd == MSP_V2_FRAME_ID) {
                    // MSPv1 payload must be big enough to hold V2 header + extra checksum
                    if (hdr->size >= sizeof(mspHeaderV2_t) + 1) {
                        mspPort->mspVersion = MSP_V2_OVER_V1;
                        mspPort->packetState = MSP_HEADER_V2_OVER_V1;
                    } else {
                        mspPort->packetState = MSP_IDLE;
                    }
                } else {
                    mspPort->dataSize = hdr->size;
                    mspPort->cmdMSP = hdr->cmd;
                    mspPort->cmdFlags = 0;
                    mspPort->offset = 0;                // re-use buffer
                    mspPort->packetState = mspPort->dataSize > 0 ? MSP_PAYLOAD_V1 : MSP_CHECKSUM_V1;    // If no payload - jump to checksum byte
                }
            }
            break;

        case MSP_PAYLOAD_V1:
            mspPort->inBuf[mspPort->offset++] = c;
            mspPort->checksum1 ^= c;
            if (mspPort->offset == mspPort->dataSize) {
                mspPort->packetState = MSP_CHECKSUM_V1;
            }
            break;

        case MSP_CHECKSUM_V1:
            if (mspPort->checksum1 == c) {
                mspPort->packetState = MSP_COMMAND_RECEIVED;
            } else {
                mspPort->packetState = MSP_IDLE;
            }
            break;

        case MSP_HEADER_V2_OVER_V1:     // V2 header is part of V1 payload - we need to calculate both checksums now
            mspPort->inBuf[mspPort->offset++] = c;
            mspPort->checksum1 ^= c;
            mspPort->checksum2 = crc8_dvb_s2(mspPort->checksum2, c);
            if (mspPort->offset == (sizeof(mspHeaderV2_t) + sizeof(mspHeaderV1_t))) {
                mspHeaderV2_t * hdrv2 = (mspHeaderV2_t *)&mspPort->inBuf[sizeof(mspHeaderV1_t)];
                if (hdrv2->size > MSP_PORT_INBUF_SIZE) {
                    mspPort->packetState = MSP_IDLE;
                } else {
                    mspPort->dataSize = hdrv2->size;
                    mspPort->cmdMSP = hdrv2->cmd;
                    mspPort->cmdFlags = hdrv2->flags;
                    mspPort->offset = 0;                // re-use buffer
                    mspPort->packetState = mspPort->dataSize > 0 ? MSP_PAYLOAD_V2_OVER_V1 : MSP_CHECKSUM_V2_OVER_V1;
                }
            }
            break;

        case MSP_PAYLOAD_V2_OVER_V1:
            mspPort->checksum2 = crc8_dvb_s2(mspPort->checksum2, c);
            mspPort->checksum1 ^= c;
            mspPort->inBuf[mspPort->offset++] = c;

            if (mspPort->offset == mspPort->dataSize) {
                mspPort->packetState = MSP_CHECKSUM_V2_OVER_V1;
            }
            break;

        case MSP_CHECKSUM_V2_OVER_V1:
            mspPort->checksum1 ^= c;
            if (mspPort->checksum2 == c) {
                mspPort->packetState = MSP_CHECKSUM_V1; // Checksum 2 correct - verify v1 checksum
            } else {
                mspPort->packetState = MSP_IDLE;
            }
            break;

        case MSP_HEADER_V2_NATIVE:
            mspPort->inBuf[mspPort->offset++] = c;
            mspPort->checksum2 = crc8_dvb_s2(mspPort->checksum2, c);
            if (mspPort->offset == sizeof(mspHeaderV2_t)) {
                mspHeaderV2_t * hdrv2 = (mspHeaderV2_t *)&mspPort->inBuf[0];
                mspPort->dataSize = hdrv2->size;
                mspPort->cmdMSP = hdrv2->cmd;
                mspPort->cmdFlags = hdrv2->flags;
                mspPort->offset = 0;                // re-use buffer
                mspPort->packetState = mspPort->dataSize > 0 ? MSP_PAYLOAD_V2_NATIVE : MSP_CHECKSUM_V2_NATIVE;
            }
            break;

        case MSP_PAYLOAD_V2_NATIVE:
            mspPort->checksum2 = crc8_dvb_s2(mspPort->checksum2, c);
            mspPort->inBuf[mspPort->offset++] = c;

            if (mspPort->offset == mspPort->dataSize) {
                mspPort->packetState = MSP_CHECKSUM_V2_NATIVE;
            }
            break;

        case MSP_CHECKSUM_V2_NATIVE:
            if (mspPort->checksum2 == c) 
            {
                mspPort->packetState = MSP_COMMAND_RECEIVED;
            } 
            else 
            {
                mspPort->packetState = MSP_IDLE;
            }
            break;
    }
}



static int mspSerialSendFrame(mspPort_t *msp, const uint8_t * hdr, int hdrLen, const uint8_t * data, int dataLen, const uint8_t * crc, int crcLen)
{
    static uint8_t txBuff[400];    
    // We are allowed to send out the response if
    //  a) TX buffer is completely empty (we are talking to well-behaving party that follows request-response scheduling;
    //     this allows us to transmit jumbo frames bigger than TX buffer (serialWriteBuf will block, but for jumbo frames we don't care)
    //  b) Response fits into TX buffer
    const int totalFrameLength = hdrLen + dataLen + crcLen;
//    if (!isSerialTransmitBufferEmpty(msp->port) && ((int)serialTxBytesFree(msp->port) < totalFrameLength)) {
//        return 0;
//    }

//    // Transmit frame
//    serialBeginWrite(msp->port);
//    serialWriteBufNoFlush(msp->port, hdr, hdrLen);
//    serialWriteBufNoFlush(msp->port, data, dataLen);
//    serialWriteBufNoFlush(msp->port, crc, crcLen);
//    serialEndWrite(msp->port);

    // 在这个位置发送msp包
//    if (msp->port->identifier)

    memcpy(txBuff, hdr, hdrLen);
    memcpy(txBuff+hdrLen, data, dataLen);
    memcpy(txBuff+hdrLen+dataLen, crc, crcLen);

    if (msp->port->identifier == SERIAL_PORT_UART1)
        UartDmaSendPack(OSD_UART, txBuff, totalFrameLength);
//    else if (msp->port->identifier == SERIAL_PORT_UART2)
//        UartDmaSendPack(DEBUG_UART, txBuff, totalFrameLength);
    
    return totalFrameLength;
}

static uint8_t mspSerialChecksumBuf(uint8_t checksum, const uint8_t *data, int len)
{
    while (len-- > 0) {
        checksum ^= *data++;
    }
    return checksum;
}

static int mspSerialEncode(mspPort_t *msp, mspPacket_t *packet, mspVersion_e mspVersion)
{
    static const uint8_t mspMagic[MSP_VERSION_COUNT] = MSP_VERSION_MAGIC_INITIALIZER;
    const int dataLen = sbufBytesRemaining(&packet->buf);
    uint8_t hdrBuf[16] = { '$', mspMagic[mspVersion], packet->result == MSP_RESULT_ERROR ? '!' : '>'};
    uint8_t crcBuf[2];
    uint8_t checksum;
    int hdrLen = 3;
    int crcLen = 0;

    #define V1_CHECKSUM_STARTPOS 3
    if (mspVersion == MSP_V1) {
        mspHeaderV1_t * hdrV1 = (mspHeaderV1_t *)&hdrBuf[hdrLen];
        hdrLen += sizeof(mspHeaderV1_t);
        hdrV1->cmd = packet->cmd;

        // Add JUMBO-frame header if necessary
        if (dataLen >= JUMBO_FRAME_SIZE_LIMIT) {
            mspHeaderJUMBO_t * hdrJUMBO = (mspHeaderJUMBO_t *)&hdrBuf[hdrLen];
            hdrLen += sizeof(mspHeaderJUMBO_t);

            hdrV1->size = JUMBO_FRAME_SIZE_LIMIT;
            hdrJUMBO->size = dataLen;
        } else {
            hdrV1->size = dataLen;
        }

        // Pre-calculate CRC
        checksum = mspSerialChecksumBuf(0, hdrBuf + V1_CHECKSUM_STARTPOS, hdrLen - V1_CHECKSUM_STARTPOS);
        checksum = mspSerialChecksumBuf(checksum, sbufPtr(&packet->buf), dataLen);
        crcBuf[crcLen++] = checksum;
    } else if (mspVersion == MSP_V2_OVER_V1) {
        mspHeaderV1_t * hdrV1 = (mspHeaderV1_t *)&hdrBuf[hdrLen];

        hdrLen += sizeof(mspHeaderV1_t);

        mspHeaderV2_t * hdrV2 = (mspHeaderV2_t *)&hdrBuf[hdrLen];
        hdrLen += sizeof(mspHeaderV2_t);

        const int v1PayloadSize = sizeof(mspHeaderV2_t) + dataLen + 1;  // MSPv2 header + data payload + MSPv2 checksum
        hdrV1->cmd = MSP_V2_FRAME_ID;

        // Add JUMBO-frame header if necessary
        if (v1PayloadSize >= JUMBO_FRAME_SIZE_LIMIT) {
            mspHeaderJUMBO_t * hdrJUMBO = (mspHeaderJUMBO_t *)&hdrBuf[hdrLen];
            hdrLen += sizeof(mspHeaderJUMBO_t);

            hdrV1->size = JUMBO_FRAME_SIZE_LIMIT;
            hdrJUMBO->size = v1PayloadSize;
        } else {
            hdrV1->size = v1PayloadSize;
        }

        // Fill V2 header
        hdrV2->flags = packet->flags;
        hdrV2->cmd = packet->cmd;
        hdrV2->size = dataLen;

        // V2 CRC: only V2 header + data payload
        checksum = crc8_dvb_s2_update(0, (uint8_t *)hdrV2, sizeof(mspHeaderV2_t));
        checksum = crc8_dvb_s2_update(checksum, sbufPtr(&packet->buf), dataLen);
        crcBuf[crcLen++] = checksum;

        // V1 CRC: All headers + data payload + V2 CRC byte
        checksum = mspSerialChecksumBuf(0, hdrBuf + V1_CHECKSUM_STARTPOS, hdrLen - V1_CHECKSUM_STARTPOS);
        checksum = mspSerialChecksumBuf(checksum, sbufPtr(&packet->buf), dataLen);
        checksum = mspSerialChecksumBuf(checksum, crcBuf, crcLen);
        crcBuf[crcLen++] = checksum;
    } else if (mspVersion == MSP_V2_NATIVE) {
        mspHeaderV2_t * hdrV2 = (mspHeaderV2_t *)&hdrBuf[hdrLen];
        hdrLen += sizeof(mspHeaderV2_t);

        hdrV2->flags = packet->flags;
        hdrV2->cmd = packet->cmd;
        hdrV2->size = dataLen;

        checksum = crc8_dvb_s2_update(0, (uint8_t *)hdrV2, sizeof(mspHeaderV2_t));
        checksum = crc8_dvb_s2_update(checksum, sbufPtr(&packet->buf), dataLen);
        crcBuf[crcLen++] = checksum;
    } else {
        // Shouldn't get here
        return 0;
    }

    // Send the frame
    return mspSerialSendFrame(msp, hdrBuf, hdrLen, sbufPtr(&packet->buf), dataLen, crcBuf, crcLen);
}

static mspPostProcessFnPtr mspSerialProcessReceivedCommand(mspPort_t *msp, mspProcessCommandFnPtr mspProcessCommandFn)
{
    static uint8_t mspSerialOutBuf[MSP_PORT_OUTBUF_SIZE];

    mspPacket_t reply = {
        .buf = { .ptr = mspSerialOutBuf, .end = ARRAYEND(mspSerialOutBuf), },
        .cmd = -1,
        .flags = 0,
        .result = 0,
        .direction = MSP_DIRECTION_REPLY,
    };
    uint8_t *outBufHead = reply.buf.ptr;

    mspPacket_t command = {
        .buf = { .ptr = msp->inBuf, .end = msp->inBuf + msp->dataSize, },
        .cmd = msp->cmdMSP,
        .flags = msp->cmdFlags,
        .result = 0,
        .direction = MSP_DIRECTION_REQUEST,
    };

    mspPostProcessFnPtr mspPostProcessFn = NULL;
    const mspResult_e status = mspProcessCommandFn(msp->descriptor, &command, &reply, &mspPostProcessFn);

    if (status != MSP_RESULT_NO_REPLY) {
        sbufSwitchToReader(&reply.buf, outBufHead); // change streambuf direction
        mspSerialEncode(msp, &reply, msp->mspVersion);
    }

    return mspPostProcessFn;
}

static void mspSerialProcessReceivedReply(mspPort_t *msp, mspProcessReplyFnPtr mspProcessReplyFn)
{
    mspPacket_t reply = {
        .buf = {
            .ptr = msp->inBuf,
            .end = msp->inBuf + msp->dataSize,
        },
        .cmd = msp->cmdMSP,
        .result = 0,
    };

    mspProcessReplyFn(&reply);
}

/**
  \brief 从串口队列包中解析MSP包
  */
static void mspProcessPacket(mspPort_t *mspPort, mspProcessCommandFnPtr mspProcessCommandFn, mspProcessReplyFnPtr mspProcessReplyFn)
{
    mspPostProcessFnPtr mspPostProcessFn = NULL;

    while (uartTotalRxBytesWaiting(mspPort->port->identifier))
    {
        const uint8_t c = serialRead(mspPort->port->identifier);
        mspSerialProcessReceivedPacketData(mspPort, c);
        if (mspPort->packetState == MSP_COMMAND_RECEIVED) {
            {
                // temp code
                extern uint8_t osdMspReceivedFlag;
                osdMspReceivedFlag = 1;
            }
            if (mspPort->packetType == MSP_PACKET_COMMAND) {
                mspPostProcessFn = mspSerialProcessReceivedCommand(mspPort, mspProcessCommandFn);
            } else if (mspPort->packetType == MSP_PACKET_REPLY) {
                mspSerialProcessReceivedReply(mspPort, mspProcessReplyFn);
            }

            // process one command at a time so as not to block
            mspPort->packetState = MSP_IDLE;
        }

        if (mspPort->packetState == MSP_IDLE) {
//            mspPort->portState = PORT_IDLE;
            break;
        }
    }

    if (mspPostProcessFn) {
//        waitForSerialPortToFinishTransmitting(mspPort->port);
        mspPostProcessFn(mspPort->port);
    }

}



int mspSerialPush(serialPortIdentifier_e port, uint8_t cmd, uint8_t *data, int datalen, mspDirection_e direction, mspVersion_e mspVersion)
{
    int ret = 0;

    for (mspPort_t *mspPort = mspPorts; mspPort < ARRAYEND(mspPorts); mspPort++) {

        // XXX Kludge!!! Avoid zombie VCP port (avoid VCP entirely for now)
        if (!mspPort->port || (port != SERIAL_PORT_ALL && mspPort->port->identifier != port)) {

            continue;
        }
        
        mspPacket_t push = {
            .buf = { .ptr = data, .end = data + datalen, },
            .cmd = cmd,
            .result = 0,
            .direction = direction,
        };

        ret = mspSerialEncode(&mspPorts[0], &push, mspVersion);
    }
    return ret; // return the number of bytes written
}

void mspSerialInit(void)
{
    memset(mspPorts, 0, sizeof(mspPorts));
    mspSerialAllocatePorts();
}

/* 外部调用解包接口 ---------------------------------*/

/**
  \brief 解析Sensor_v2 MSP包
  */
void mspSensorProcessV2Packet(mspProcessCommandFnPtr mspProcessCommandFn, mspProcessReplyFnPtr mspProcessReplyFn)
{
    mspProcessPacket(&mspPorts[1], mspProcessCommandFn, mspProcessReplyFn);
}

/**
  \brief 解析数字图传数传MSP包
  */
void mspSerialProcessVtxPacket(mspProcessCommandFnPtr mspProcessCommandFn, mspProcessReplyFnPtr mspProcessReplyFn)
{
    mspProcessPacket(&mspPorts[0], mspProcessCommandFn, mspProcessReplyFn);
}


