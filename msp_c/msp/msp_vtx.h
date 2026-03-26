#ifndef _MSP_VTX_H
#define _MSP_VTX_H

#include "board.h"
#include "cms_menu_main.h"

#define MSP_VTX_RX_SRART                8
#define InitSetVtx                      0
#define NormalSetVtx                    1

enum {
    CADDX_Walksnail=0,
    HD_Zero,
    DJI_O3,
};

extern uint8_t MspVtxStatus;
extern uint8_t VTX_Type;

void MspVtxFrameResponse(void);
void MspVtxReceivedData(uint8_t Data);
void MspVtxSetChPower(VTXDataType *Target,uint8_t SetFlag);

#endif
