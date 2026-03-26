#ifndef _MSP_BOX_H
#define _MSP_BOX_H

#include <stdint.h>

typedef struct box_s {
    const char *boxName;            // GUI-readable box name
    const uint8_t boxId;            // see boxId_e
    const uint8_t permanentId;      // permanent ID used to identify BOX. This ID is unique for one function, DO NOT REUSE IT
} box_t;

void mspGetFlightMode(uint32_t* mspFlightModeFlags);
void mspGetArmingDisableFlags(uint32_t* mspArmingDisableFlags);

#endif /* _MSP_BOX_H */
