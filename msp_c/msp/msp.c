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

/* ---------------------------------------------------------------
 * MSP encoding helpers
 *
 *  encodeAcc   : float in g       → int16  (1 unit = 1/512 g,  range ±64 g)
 *  encodeGyro  : float in rad/s   → int16  (1 unit = 1 deg/s,  range ±572 rad/s)
 *  encodeAttitude: float in deg   → int16  (1 unit = 0.1 °,    range ±3276.7 °)
 * --------------------------------------------------------------- */
#define RAD_TO_DEG_F  (180.0f / 3.14159265358979f)

static uint16_t encodeToInt16Clamped(float value)
{
    long v = lrintf(value);
    if (v >  32767) v =  32767;
    if (v < -32768) v = -32768;
    return (uint16_t)(int16_t)v;
}

/* acc in g  →  int16 at 512 units/g */
static uint16_t encodeAcc(float acc_g)
{
    return encodeToInt16Clamped(acc_g * 512.0f);
}

/* gyro in rad/s  →  int16 at 1 unit per deg/s */
static uint16_t encodeGyro(float gyro_rads)
{
    return encodeToInt16Clamped(gyro_rads * RAD_TO_DEG_F);
}

/* attitude angle in degrees  →  int16 at 0.1 deg resolution */
static uint16_t encodeAttitude(float deg)
{
    return encodeToInt16Clamped(deg * 10.0f);
}

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
        case MSP_RAW_IMU:
            /* acc: g units  → 512 units/g  (MSP standard) */
            sbufWriteU16(dst, encodeAcc(sensorData.acc.x));
            sbufWriteU16(dst, encodeAcc(sensorData.acc.y));
            sbufWriteU16(dst, encodeAcc(sensorData.acc.z));
            /* gyro: rad/s  → 1 unit per deg/s */
            sbufWriteU16(dst, encodeGyro(sensorData.gyro.x));
            sbufWriteU16(dst, encodeGyro(sensorData.gyro.y));
            sbufWriteU16(dst, encodeGyro(sensorData.gyro.z));
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
        case MSP_ATTITUDE:
            /* attitude angles in degrees  → 0.1 deg resolution (MSP standard) */
            sbufWriteU16(dst, encodeAttitude(state.attitude.x));
            sbufWriteU16(dst, encodeAttitude(state.attitude.y));
            sbufWriteU16(dst, encodeAttitude(state.attitude.z));
            break;
        case MSP_PID:
            for (int i = 0; i < PID_ITEM_COUNT; i++) {
                sbufWriteU8(dst, currentPidProfile->pid[i].P);
                sbufWriteU8(dst, currentPidProfile->pid[i].I);
                sbufWriteU8(dst, currentPidProfile->pid[i].D);
            }
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
    case MSP_RC_TUNING:
        sbufWriteU8(dst, currentControlRateProfile->rcRates[FD_ROLL]);
        sbufWriteU8(dst, currentControlRateProfile->rcExpo[FD_ROLL]);
        for (int i = 0 ; i < 3; i++) {
            sbufWriteU8(dst, currentControlRateProfile->rates[i]); // R,P,Y see flight_dynamics_index_t
        }
        sbufWriteU8(dst, 0);   // was currentControlRateProfile->tpa_rate
        sbufWriteU8(dst, currentControlRateProfile->thrMid8);
        sbufWriteU8(dst, currentControlRateProfile->thrExpo8);
        sbufWriteU16(dst, 0);   // was currentControlRateProfile->tpa_breakpoint
        sbufWriteU8(dst, currentControlRateProfile->rcExpo[FD_YAW]);
        sbufWriteU8(dst, currentControlRateProfile->rcRates[FD_YAW]);
        sbufWriteU8(dst, currentControlRateProfile->rcRates[FD_PITCH]);
        sbufWriteU8(dst, currentControlRateProfile->rcExpo[FD_PITCH]);

        // added in 1.41
        sbufWriteU8(dst, currentControlRateProfile->throttle_limit_type);
        sbufWriteU8(dst, currentControlRateProfile->throttle_limit_percent);

        // added in 1.42
        sbufWriteU16(dst, currentControlRateProfile->rate_limit[FD_ROLL]);
        sbufWriteU16(dst, currentControlRateProfile->rate_limit[FD_PITCH]);
        sbufWriteU16(dst, currentControlRateProfile->rate_limit[FD_YAW]);

        // added in 1.43
        sbufWriteU8(dst, currentControlRateProfile->rates_type);

        // added in 1.47
        sbufWriteU8(dst, currentControlRateProfile->thrHover8);

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
        case MSP_SET_PID:
            for (int i = 0; i < PID_ITEM_COUNT; i++) {
                currentPidProfile->pid[i].P = sbufReadU8(src);
                currentPidProfile->pid[i].I = sbufReadU8(src);
                currentPidProfile->pid[i].D = sbufReadU8(src);
            }
            pidInitConfig(currentPidProfile);
            break;
        case MSP_SET_MOTOR:
            for (int i = 0; i < getMotorCount(); i++) {
                motor_disarmed[i] = motorConvertFromExternal(sbufReadU16(src));
            }
            break;
        case MSP_SET_RC_TUNING:
            if (sbufBytesRemaining(src) >= 10) {
                uint8_t rcRateRoll = sbufReadU8(src);
                uint8_t rcExpoRoll = sbufReadU8(src);
                uint8_t rateRoll = sbufReadU8(src);
                uint8_t ratePitch = sbufReadU8(src);
                uint8_t rateYaw = sbufReadU8(src);
                sbufReadU8(src);    // tpa_rate (not used)
                uint8_t thrMid = sbufReadU8(src);
                uint8_t thrExpo = sbufReadU8(src);
                sbufReadU16(src);   // tpa_breakpoint (not used)

                uint8_t rcExpoYaw = rcExpoRoll;
                uint8_t rcRateYaw = rcRateRoll;
                uint8_t rcRatePitch = rcRateRoll;
                uint8_t rcExpoPitch = rcExpoRoll;

                if (sbufBytesRemaining(src) >= 1) {
                    rcExpoYaw = sbufReadU8(src);
                }

                if (sbufBytesRemaining(src) >= 1) {
                    rcRateYaw = sbufReadU8(src);
                }

                if (sbufBytesRemaining(src) >= 1) {
                    rcRatePitch = sbufReadU8(src);
                }

                if (sbufBytesRemaining(src) >= 1) {
                    rcExpoPitch = sbufReadU8(src);
                }

                // version 1.41: throttle_limit (not used)
                if (sbufBytesRemaining(src) >= 2) {
                    sbufReadU8(src);
                    sbufReadU8(src);
                }

                // version 1.42: rate_limit (not used)
                if (sbufBytesRemaining(src) >= 6) {
                    sbufReadU16(src);
                    sbufReadU16(src);
                    sbufReadU16(src);
                }

                // version 1.43: rates_type (ignored)
                if (sbufBytesRemaining(src) >= 1) {
                    sbufReadU8(src);
                }

                // version 1.47: thrHover8 (not used)
                if (sbufBytesRemaining(src) >= 1) {
                    sbufReadU8(src);
                }

                /* Update runtime rcRateProfile */
                rcRateProfile.rcRates[ROLL] = rcRateRoll;
                rcRateProfile.rcExpo[ROLL] = rcExpoRoll;
                rcRateProfile.rates[ROLL] = rateRoll;
                rcRateProfile.rates[PITCH] = ratePitch;
                rcRateProfile.rates[YAW] = rateYaw;
                rcRateProfile.rcExpo[YAW] = rcExpoYaw;
                rcRateProfile.rcRates[YAW] = rcRateYaw;
                rcRateProfile.rcRates[PITCH] = rcRatePitch;
                rcRateProfile.rcExpo[PITCH] = rcExpoPitch;

                thrMid8 = thrMid;
                thrExpo8 = thrExpo;

                rateWriteToFlash();
                break;
        case MSP_RESET_CONF:
            if (sbufBytesRemaining(src) >= 1) {
                // Added in MSP API 1.42
                const uint8_t resetIndex = sbufReadU8(src);
                
                if (resetIndex == 1) {
                    /* Reset PID parameters to default values */
                    ratePidReset();
                    pidWriteToFlash();
                } else if (resetIndex == 2) {
                    /* Reset RATE parameters to default values */
                    rcResetParam();
                    rateWriteToFlash();
                }
                /* resetIndex == 0: do nothing */
            }

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
