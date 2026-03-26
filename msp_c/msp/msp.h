#ifndef _MSP_H_
#define _MSP_H_

#include <stdint.h>
#include <stdbool.h>
#include "msp.h"
#include "streambuf.h"
#include "serial.h"

#define MSP_V2_FRAME_ID         255

typedef enum {
    MSP_V1          = 0,
    MSP_V2_OVER_V1  = 1,
    MSP_V2_NATIVE   = 2,
    MSP_VERSION_COUNT
} mspVersion_e;

#define MSP_VERSION_MAGIC_INITIALIZER { 'M', 'M', 'X' }

typedef enum {
    MSP_RESULT_ACK = 1,
    MSP_RESULT_ERROR = -1,
    MSP_RESULT_NO_REPLY = 0,
    MSP_RESULT_CMD_UNKNOWN = -2,   // don't know how to process command, try next handler
} mspResult_e;

typedef enum {
    MSP_DIRECTION_REPLY = 0,
    MSP_DIRECTION_REQUEST = 1
} mspDirection_e;

typedef struct mspPacket_s {
    sbuf_t buf;         // payload only w/o header or crc
    int16_t cmd;
    int16_t result;
    uint8_t flags;      // MSPv2 flags byte. It looks like unused (yet?).
    uint8_t direction;  // It also looks like unused and might be deleted.
} mspPacket_t;

typedef int mspDescriptor_t;

struct serialPort_s;
typedef void (*mspPostProcessFnPtr)(struct serialPort_s *port); // msp post process function, used for gracefully handling reboots, etc.
typedef mspResult_e (*mspProcessCommandFnPtr)(mspDescriptor_t srcDesc, mspPacket_t *cmd, mspPacket_t *reply, mspPostProcessFnPtr *mspPostProcessFn);
typedef void (*mspProcessReplyFnPtr)(mspPacket_t *cmd);

mspResult_e mspFcProcessCommand(mspDescriptor_t srcDesc, mspPacket_t *cmd, mspPacket_t *reply, mspPostProcessFnPtr *mspPostProcessFn);
void mspFcProcessReply(mspPacket_t *reply);


mspDescriptor_t mspDescriptorAlloc(void);


#endif /* _MSP_H_ */
