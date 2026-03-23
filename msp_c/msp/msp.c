#include "msp.h"
#include "msp_protocol.h"
#include "msp_protocol_v2_common.h"
#include "sensor_v2.h"
#include "rc.h"
#include "battery.h"
#include "msp_box.h"

enum {
    MSP_REBOOT_FIRMWARE = 0,
    MSP_REBOOT_BOOTLOADER_ROM,
    MSP_REBOOT_MSC,
    MSP_REBOOT_MSC_UTC,
    MSP_REBOOT_BOOTLOADER_FLASH,
    MSP_REBOOT_COUNT,
};

static uint8_t rebootMode;

static int mspDescriptor = 0;

uint8_t test_debug;

mspDescriptor_t mspDescriptorAlloc(void)
{
    return (mspDescriptor_t)mspDescriptor++;
}
#define FC_VERSION_YEAR             2026
#define FC_CALVER_BASE_YEAR 2000

#define FC_VERSION_MONTH            6
#define FC_VERSION_PATCH_LEVEL      0


# define FC_VERSION_SUFFIX_STR ""

#define FC_VERSION_STRING STR(FC_VERSION_YEAR) "." STR(FC_VERSION_MONTH) "." STR(FC_VERSION_PATCH_LEVEL) FC_VERSION_SUFFIX_STR
extern RCDATA_t rcData;

static bool mspCommonProcessOutCommand(int16_t cmdMSP, sbuf_t *dst, mspPostProcessFnPtr *mspPostProcessFn)
{
    bool unsupportedCommand = false;
    uint32_t flightModeFlag;
    mspGetFlightMode(&flightModeFlag);
    uint32_t armingDisableFlags;
    mspGetArmingDisableFlags(&armingDisableFlags);
    
    switch (cmdMSP) 
    {
        case MSP_FC_VERSION:
            sbufWriteU8(dst, (uint8_t)(FC_VERSION_YEAR - FC_CALVER_BASE_YEAR)); // year since 2000
            sbufWriteU8(dst, FC_VERSION_MONTH);
            sbufWriteU8(dst, FC_VERSION_PATCH_LEVEL);
//            sbufWritePString(dst, FC_VERSION_STRING);
            break;
        case MSP_NAME:
            sbufWriteString(dst, "Aquila16");
            break;
        case MSP_STATUS_EX:
        case MSP_STATUS:
            sbufWriteU16(dst, 0); // PID循环时间
            sbufWriteU16(dst, 0); // I2C错误计数
            sbufWriteU16(dst, 0x33); // 传感器配置
            sbufWriteData(dst, &flightModeFlag, 4);
            sbufWriteU8(dst, 1); //current Pid Profile Index
            sbufWriteU16(dst, 0); //average System Load Percent
            if (cmdMSP == MSP_STATUS_EX) {
                sbufWriteU8(dst, 0);
                sbufWriteU8(dst, 0);
            } else {  // MSP_STATUS
                sbufWriteU16(dst, 0);
            }
            sbufWriteU8(dst, 0);
            sbufWriteU8(dst, 0x1D); //ARMING  DISABLE FLAGS COUNT
            sbufWriteU32(dst, armingDisableFlags);
            sbufWriteU8(dst, 0); // accCalibAxisFlags
            break;
        case MSP_RC:
            sbufWriteU16(dst, rcData.roll);
            sbufWriteU16(dst, rcData.pitch);
            sbufWriteU16(dst, rcData.throttle);
            sbufWriteU16(dst, rcData.yaw);
            sbufWriteU16(dst, rcData.aux1);
            sbufWriteU16(dst, rcData.aux2);
            sbufWriteU16(dst, rcData.aux3);
            sbufWriteU16(dst, rcData.aux4);
            sbufWriteU16(dst, rcData.aux5);
            sbufWriteU16(dst, rcData.aux6);
            sbufWriteU16(dst, rcData.aux7);
            sbufWriteU16(dst, rcData.aux8);
            sbufWriteU16(dst, rcData.aux9);
            sbufWriteU16(dst, rcData.aux10);
            sbufWriteU16(dst, rcData.aux11);
            sbufWriteU16(dst, rcData.aux12);
            break;
        case MSP_ANALOG:
            sbufWriteU8(dst, 0);
            sbufWriteU16(dst, 0); // milliamp hours drawn from battery
            sbufWriteU16(dst, 0);
            sbufWriteU16(dst, 0); // send current in 0.01 A steps, range is -320A to 320A
            sbufWriteU16(dst, 0);
            break;
        case MSP_BATTERY_STATE:
            // battery characteristics
            sbufWriteU8(dst, 2); // 0 indicates battery not detected. // 电芯数量
            sbufWriteU16(dst, 0); // in mAh

            // battery state
            sbufWriteU8(dst, (uint8_t)(getBatteryVoltage()*10)); // 上一时刻电池电压 // in 0.1V steps
            sbufWriteU16(dst, 0); // milliamp hours drawn from battery
            sbufWriteU16(dst, 0); // send current in 0.01 A steps, range is -320A to 320A

            // battery alerts
            sbufWriteU8(dst, getBatteryStatus());

            sbufWriteU16(dst, (uint16_t)(getBatteryVoltage()*100)); // in 0.01V steps
            break;
        default:
            unsupportedCommand = true;
        }
    return !unsupportedCommand;
    
}

//static bool mspProcessOutCommand(mspDescriptor_t srcDesc, int16_t cmdMSP, sbuf_t *dst)
//{

//}

static mspResult_e mspCommonProcessInCommand(mspDescriptor_t srcDesc, int16_t cmdMSP, sbuf_t *src, mspPostProcessFnPtr *mspPostProcessFn)
{
    uint32_t i;
    uint8_t value;
    
    switch (cmdMSP) 
    {
        case MSP2_SENSOR_RANGEFINDER_LIDARMT:
            sv2RangefinderReceiveNewData(sbufPtr(src));
            break;
        case MSP2_SENSOR_OPTICALFLOW_MT:
            sv2OpticalflowReceiveNewData(sbufPtr(src));
            break;
        default:
            return MSP_RESULT_CMD_UNKNOWN;
            break;
    }
    return MSP_RESULT_ACK;
}



//static mspResult_e mspProcessInCommand(mspDescriptor_t srcDesc, int16_t cmdMSP, sbuf_t *src)
//{

//}

/*
 * Returns MSP_RESULT_ACK, MSP_RESULT_ERROR or MSP_RESULT_NO_REPLY
 */
mspResult_e mspFcProcessCommand(mspDescriptor_t srcDesc, mspPacket_t *cmd, mspPacket_t *reply, mspPostProcessFnPtr *mspPostProcessFn)
{
    int ret = MSP_RESULT_ACK;
    sbuf_t *dst = &reply->buf;
    sbuf_t *src = &cmd->buf;
    const int16_t cmdMSP = cmd->cmd;
    // initialize reply by default
    reply->cmd = cmd->cmd;

    if (mspCommonProcessOutCommand(cmdMSP, dst, mspPostProcessFn)) {
        ret = MSP_RESULT_ACK;
//    } else if (mspProcessOutCommand(srcDesc, cmdMSP, dst)) {
//        ret = MSP_RESULT_ACK;
//    } else if ((ret = mspFcProcessOutCommandWithArg(srcDesc, cmdMSP, src, dst, mspPostProcessFn)) != MSP_RESULT_CMD_UNKNOWN) {
//        /* ret */;
//    } else if (cmdMSP == MSP_SET_PASSTHROUGH) {
//        mspFcSetPassthroughCommand(dst, src, mspPostProcessFn);
//        ret = MSP_RESULT_ACK;
//#ifdef USE_FLASHFS
//    } else if (cmdMSP == MSP_DATAFLASH_READ) {
//        mspFcDataFlashReadCommand(dst, src);
//        ret = MSP_RESULT_ACK;
//#endif
    } else {
        ret = mspCommonProcessInCommand(srcDesc, cmdMSP, src, mspPostProcessFn);
    }
    
    reply->result = ret;
    return ret;
}

void mspFcProcessReply(mspPacket_t *reply)
{

}
