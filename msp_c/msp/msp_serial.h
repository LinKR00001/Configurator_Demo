#ifndef _MSP_SERIAL_H_
#define _MSP_SERIAL_H_

#include <stdlib.h>
#include <stdint.h>
#include "msp.h"
#include "serial.h"

#ifndef MAX_MSP_PORT_COUNT
#define MAX_MSP_PORT_COUNT 3
#endif

typedef enum {
    MSP_IDLE,
    MSP_HEADER_START,
    MSP_HEADER_M,
    MSP_HEADER_X,

    MSP_HEADER_V1,
    MSP_PAYLOAD_V1,
    MSP_CHECKSUM_V1,

    MSP_HEADER_V2_OVER_V1,
    MSP_PAYLOAD_V2_OVER_V1,
    MSP_CHECKSUM_V2_OVER_V1,

    MSP_HEADER_V2_NATIVE,
    MSP_PAYLOAD_V2_NATIVE,
    MSP_CHECKSUM_V2_NATIVE,

    MSP_COMMAND_RECEIVED
} mspPacketState_e;

typedef enum {
    MSP_PACKET_COMMAND,
    MSP_PACKET_REPLY
} mspPacketType_e;


#define MSP_PORT_INBUF_SIZE 192
#define MSP_PORT_OUTBUF_SIZE 512
#define JUMBO_FRAME_SIZE_LIMIT 255

typedef struct __attribute__((packed)) {
    uint8_t size;
    uint8_t cmd;
} mspHeaderV1_t;

typedef struct __attribute__((packed)) {
    uint16_t size;
} mspHeaderJUMBO_t;

typedef struct __attribute__((packed)){
    uint8_t  flags;
    uint16_t cmd;
    uint16_t size;
} mspHeaderV2_t;

typedef struct mspPort_s {
    struct serialPort_s *port; // null when port unused.
//    timeMs_t lastActivityMs;
//    mspPendingSystemRequest_e pendingRequest;
//    mspPortState_e portState;
    mspPacketState_e packetState;
    mspPacketType_e packetType;
    uint8_t inBuf[MSP_PORT_INBUF_SIZE];
    uint16_t cmdMSP;
    uint8_t cmdFlags;
    mspVersion_e mspVersion;
    uint_fast16_t offset;
    uint_fast16_t dataSize;
    uint8_t checksum1;
    uint8_t checksum2;
    bool sharedWithTelemetry;
    mspDescriptor_t descriptor;
} mspPort_t;

void mspSerialInit(void);
void mspSerialAllocatePorts(void);

int mspSerialPush(serialPortIdentifier_e port, uint8_t cmd, uint8_t *data, int datalen, mspDirection_e direction, mspVersion_e mspVersion);

void mspSerialProcess(mspProcessCommandFnPtr mspProcessCommandFn, mspProcessReplyFnPtr mspProcessReplyFn);

/* 外部调用解包接口 ---------------------------------*/
void mspSensorProcessV2Packet(mspProcessCommandFnPtr mspProcessCommandFn, mspProcessReplyFnPtr mspProcessReplyFn);
void mspSerialProcessVtxPacket(mspProcessCommandFnPtr mspProcessCommandFn, mspProcessReplyFnPtr mspProcessReplyFn);

#endif /* _MSP_SERIAL_H_ */
