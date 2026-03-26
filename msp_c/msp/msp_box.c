#include "msp_box.h"
#include "flightStatus.h"

typedef enum {
    // ARM flag
    BOXARM = 0,
    // FLIGHT_MODE
    BOXANGLE,
    BOXHORIZON,
    BOXMAG,
    BOXALTHOLD,
    BOXHEADFREE,
    BOXCHIRP,
    BOXPASSTHRU,
    BOXFAILSAFE,
    BOXPOSHOLD,
    BOXGPSRESCUE,
    BOXID_FLIGHTMODE_LAST = BOXGPSRESCUE,

// When new flight modes are added, the parameter group version for 'modeActivationConditions' in src/main/fc/rc_modes.c has to be incremented to ensure that the RC modes configuration is reset.

    // RCMODE flags
    BOXANTIGRAVITY,
    BOXHEADADJ,
    BOXCAMSTAB,
    BOXBEEPERON,
    BOXLEDLOW,
    BOXCALIB,
    BOXOSD,
    BOXTELEMETRY,
    BOXSERVO1,
    BOXSERVO2,
    BOXSERVO3,
    BOXBLACKBOX,
    BOXAIRMODE,
    BOX3D,
    BOXFPVANGLEMIX,
    BOXBLACKBOXERASE,
    BOXCAMERA1,
    BOXCAMERA2,
    BOXCAMERA3,
    BOXCRASHFLIP,
    BOXPREARM,
    BOXBEEPGPSCOUNT,
    BOXVTXPITMODE,
    BOXPARALYZE,
    BOXUSER1,
    BOXUSER2,
    BOXUSER3,
    BOXUSER4,
    BOXPIDAUDIO,
    BOXACROTRAINER,
    BOXVTXCONTROLDISABLE,
    BOXLAUNCHCONTROL,
    BOXMSPOVERRIDE,
    BOXSTICKCOMMANDDISABLE,
    BOXBEEPERMUTE,
    BOXREADY,
    BOXLAPTIMERRESET,
    CHECKBOX_ITEM_COUNT
} boxId_e;

// permanent IDs must uniquely identify BOX meaning, DO NOT REUSE THEM!
static const box_t boxes[CHECKBOX_ITEM_COUNT] = {
    { .boxId = BOXARM, .boxName = "ARM", .permanentId = 0 },
    { .boxId = BOXANGLE, .boxName = "ANGLE", .permanentId = 1 },
    { .boxId = BOXHORIZON, .boxName = "HORIZON", .permanentId = 2 },
    { .boxId = BOXALTHOLD, .boxName = "ALTHOLD", .permanentId = 3 },
    { .boxId = BOXANTIGRAVITY, .boxName = "ANTI GRAVITY", .permanentId = 4 },
    { .boxId = BOXMAG, .boxName = "MAG", .permanentId = 5 },
    { .boxId = BOXHEADFREE, .boxName = "HEADFREE", .permanentId = 6 },
    { .boxId = BOXHEADADJ, .boxName = "HEADADJ", .permanentId = 7 },
    { .boxId = BOXCAMSTAB, .boxName = "CAMSTAB", .permanentId = 8 },
//    { .boxId = BOXCAMTRIG, .boxName = "CAMTRIG", .permanentId = 9 },
//    { .boxId = BOXGPSHOME, .boxName = "GPS HOME", .permanentId = 10 },
    { .boxId = BOXPOSHOLD, .boxName = "POS HOLD", .permanentId = 11 },
    { .boxId = BOXPASSTHRU, .boxName = "PASSTHRU", .permanentId = 12 },
    { .boxId = BOXBEEPERON, .boxName = "BEEPER", .permanentId = 13 },
//    { .boxId = BOXLEDMAX, .boxName = "LEDMAX", .permanentId = 14 }, (removed)
    { .boxId = BOXLEDLOW, .boxName = "LEDLOW", .permanentId = 15 },
//    { .boxId = BOXLLIGHTS, .boxName = "LLIGHTS", .permanentId = 16 }, (removed)
    { .boxId = BOXCALIB, .boxName = "CALIB", .permanentId = 17 },
//    { .boxId = BOXGOV, .boxName = "GOVERNOR", .permanentId = 18 }, (removed)
    { .boxId = BOXOSD, .boxName = "OSD DISABLE", .permanentId = 19 },
    { .boxId = BOXTELEMETRY, .boxName = "TELEMETRY", .permanentId = 20 },
//    { .boxId = BOXGTUNE, .boxName = "GTUNE", .permanentId = 21 }, (removed)
//    { .boxId = BOXRANGEFINDER, .boxName = "RANGEFINDER", .permanentId = 22 }, (removed)
    { .boxId = BOXSERVO1, .boxName = "SERVO1", .permanentId = 23 },
    { .boxId = BOXSERVO2, .boxName = "SERVO2", .permanentId = 24 },
    { .boxId = BOXSERVO3, .boxName = "SERVO3", .permanentId = 25 },
    { .boxId = BOXBLACKBOX, .boxName = "BLACKBOX", .permanentId = 26 },
    { .boxId = BOXFAILSAFE, .boxName = "FAILSAFE", .permanentId = 27 },
    { .boxId = BOXAIRMODE, .boxName = "AIR MODE", .permanentId = 28 },
    { .boxId = BOX3D, .boxName = "3D DISABLE", .permanentId = 29},
    { .boxId = BOXFPVANGLEMIX, .boxName = "FPV ANGLE MIX", .permanentId = 30},
    { .boxId = BOXBLACKBOXERASE, .boxName = "BLACKBOX ERASE", .permanentId = 31 },
    { .boxId = BOXCAMERA1, .boxName = "CAMERA CONTROL 1", .permanentId = 32},
    { .boxId = BOXCAMERA2, .boxName = "CAMERA CONTROL 2", .permanentId = 33},
    { .boxId = BOXCAMERA3, .boxName = "CAMERA CONTROL 3", .permanentId = 34 },
    { .boxId = BOXCRASHFLIP, .boxName = "FLIP OVER AFTER CRASH", .permanentId = 35 },
    { .boxId = BOXPREARM, .boxName = "PREARM", .permanentId = 36 },
    { .boxId = BOXBEEPGPSCOUNT, .boxName = "GPS BEEP SATELLITE COUNT", .permanentId = 37 },
//    { .boxId = BOX3DONASWITCH, .boxName = "3D ON A SWITCH", .permanentId = 38 }, (removed)
    { .boxId = BOXVTXPITMODE, .boxName = "VTX PIT MODE", .permanentId = 39 },
    { .boxId = BOXUSER1, .boxName = "USER1", .permanentId = 40 }, // may be overridden by modeActivationConfig
    { .boxId = BOXUSER2, .boxName = "USER2", .permanentId = 41 },
    { .boxId = BOXUSER3, .boxName = "USER3", .permanentId = 42 },
    { .boxId = BOXUSER4, .boxName = "USER4", .permanentId = 43 },
    { .boxId = BOXPIDAUDIO, .boxName = "PID AUDIO", .permanentId = 44 },
    { .boxId = BOXPARALYZE, .boxName = "PARALYZE", .permanentId = 45 },
    { .boxId = BOXGPSRESCUE, .boxName = "GPS RESCUE", .permanentId = 46 },
    { .boxId = BOXACROTRAINER, .boxName = "ACRO TRAINER", .permanentId = 47 },
    { .boxId = BOXVTXCONTROLDISABLE, .boxName = "VTX CONTROL DISABLE", .permanentId = 48},
    { .boxId = BOXLAUNCHCONTROL, .boxName = "LAUNCH CONTROL", .permanentId = 49 },
    { .boxId = BOXMSPOVERRIDE, .boxName = "MSP OVERRIDE", .permanentId = 50},
    { .boxId = BOXSTICKCOMMANDDISABLE, .boxName = "STICK COMMANDS DISABLE", .permanentId = 51},
    { .boxId = BOXBEEPERMUTE, .boxName = "BEEPER MUTE", .permanentId = 52},
    { .boxId = BOXREADY, .boxName = "READY", .permanentId = 53},
    { .boxId = BOXLAPTIMERRESET, .boxName = "LAP TIMER RESET", .permanentId = 54},
    { .boxId = BOXCHIRP, .boxName = "CHIRP", .permanentId = 55}
};

void mspGetFlightMode(uint32_t* mspFlightModeFlags)
{
    uint32_t flightModeFlag = 0;
    //获取飞行模式标志
    switch (getFlightMode())
    {
        case MANUAL:
            flightModeFlag |= 0;
            break;
        case SPORT:
            flightModeFlag |= 1 << 1;
            break;
        case NORMAL:
            flightModeFlag |= 1 << 3;
            flightModeFlag |= 1 << 11;
            break;
        case AUTOLAND:
            break;
        case TURTLE:
            break;
        default:
            break;
    }
    
    if (getArmedStatus() == ARMED)
        flightModeFlag |= 1;

    *mspFlightModeFlags = flightModeFlag;
}

void mspGetArmingDisableFlags(uint32_t* mspArmingDisableFlags)
{
    uint16_t armingDisableFlags = 0;
    
    if (getFailSafeStatus() == true)
    {
        armingDisableFlags = 1 << 2;          //无接收机信号
    }
    
    if (getArmedStatus() == DISARMED)   //上锁
    {
        armingDisableFlags |= 1 << 28;
    }
    else                                    //解锁
    {
        armingDisableFlags = 0;
    }
    *mspArmingDisableFlags = armingDisableFlags;
}
