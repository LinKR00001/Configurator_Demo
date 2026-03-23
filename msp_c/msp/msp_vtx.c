#include "msp_vtx.h"
#include "stdio.h"
#include "battery.h"
#include "drv_uart.h"
#include "parameter.h"
#include "crossfire.h"
#include "streambuf.h"
#include "flightStatus.h"

extern RCDATA_t rcData;

#define MSP_HEADER_DOLLAR               0x24    //Msp VTX帧头
#define MSP_HEADER_X                    0x58
#define MSP_HEADER_REQUEST              0x3C
#define MSP_HEADER_RESPONSE             0x3E
#define MSP_HEADER_ERROR                0x21
#define MSP_HEADER_SIZE                 6

#define MSP_FC_VARIANT                  0x02    //in message          请求获取飞控固件名字？
#define MSP_FC_VERSION                  0x03    //out message         请求获取飞控型号名字
#define MSP_NAME                        0x0A    //out message          Returns user set board name - betaflight
#define MSP_FILTER_CONFIG               0x5C
#define MSP_PID_ADVANCED                0x5E
#define MSP_ANALOG                      0x6E
#define MSP_BATTERY_STATE               0x82    //out message         Connected/Disconnected, Voltage, Current Used
#define MSP_OSD_CONFIG                  0x52    //out message         Get osd settings - betaflight

#define MSP_VTX_CONFIG                  0x58    //out message         Get vtx settings - FC->VTX
#define MSP_SET_VTX_CONFIG              0x59    //in message          Set vtx settings - VTX->FC

#define MSP_VTXTABLE_BAND               0x89    //out message         vtxTable band/channel data                                FC->VTX
#define MSP_SET_VTXTABLE_BAND           0xE3    //in message          set vtxTable band/channel data (one band at a time)       VTX->FC

#define MSP_VTXTABLE_POWERLEVEL         0x8A    //out message         vtxTable powerLevel data                                  FC->VTX
#define MSP_SET_VTXTABLE_POWERLEVEL     0xE4    //in message          set vtxTable powerLevel data (one powerLevel at a time)   VTX->FC

#define MSP_EEPROM_WRITE                0xFA    //in message          no param
#define MSP_REBOOT                      0x44    //in message          reboot settings

#define MSP_OSD_CANVAS                  0xBD    // out message          Get osd canvas size COLSxROWS
#define MSP_SET_OSD_CANVAS              0xBC    // in message           Set osd canvas size COLSxROWS                           VTX->FC


//HD Zero Lite 在后期会频繁请求
#define MSP_STATUS                      0x65    //out message         cycletime & errors_count & sensor present & box activation & current setting number
#define MSP_RC                          0x69    //out message         rc channels and more

uint16_t TimeTime=0;
uint8_t  VTX_Type=CADDX_Walksnail;      //数传类型
uint8_t  InitFlag=0;                    //初始化标志，先获取保存的频点功率信息才可以启动协议回复功能
uint8_t  VtxChNum=0;                    //每个band数的通道数
uint8_t  VtxBandNum=0;                  //VTX频点表 band数
uint8_t  VtxPowerNum=0;                 //VTX提供的Power级别个数
uint8_t  RxBandBufNum=0;                //当前接收到的band数
uint8_t  RxPowerBufNum=0;               //当前接收到的Power数
uint8_t  MspRxVtxBandBuf[6][40];        //接收band缓冲区
uint8_t  MspRxVtxPowerBuf[6][30];       //接收Power缓冲区

uint8_t  MspVtxStatus=0;                //MSP VTX状态，8为可以进行OSD字符数据输出
uint16_t MspVtxRxLen=0;                 //MSP VTX包接收长度
uint8_t  MspRxDataBuf[512];             //MSP VTX包接收缓冲区
uint8_t  FcRequestVtxConfigFlag = 0;    //接收VTX 配置标准为，bit0:接收band信息完成,bit1:接收Power信息完成

uint8_t  FcResponseClearConfig[]={0x24,0x4D,0x3E,0x00,0x59,0x59};                //用于回应MSP_SET_VTX_CONFIG
uint8_t  FcResponseCanvas[]={0x24,0x4D,0x3E,0x00,0xBC,0xBC};                     //用于回应画布大小确认。MSP_SET_OSD_CANVAS
uint8_t  FcResponseWriteEP[]={0x24,0x4D,0x3E,0x00,0xFA,0xFA};                    //用于回应MSP_EEPROM_WRITE
uint8_t  FcResponseFwName[]={0x24,0x4D,0x3E,0x04,0x02,0x42,0x54,0x46,0x4C,0x1A}; //用于回应MSP_FC_VARIANT

uint8_t  FcResponseDisplayport0[]={0x24,0x4D,0x3E,0x01,0xB6,0x00,0xB7,0x24,0x4D,0x3E,0x01,0xB6,0x02,0xB5,0x24,0x4D,0x3E,0x01,0xB6,0x04,0xB3};
uint8_t  FcResponseDisplayport1[]={0x24,0x4D,0x3E,0x01,0xB6,0x00,0xB7,0x24,0x4D,0x3E,0x01,0xB6,0x04,0xB3};
   
uint16_t VtxFreqTable[]=
{
	//A
	5865,5845,5825,5805,5785,5765,5745,5725,
	//B
	5733,5752,5771,5790,5809,5828,5847,5866,
	//E
	5705,5685,5665,5645,5885,5905,5925,5945,
    //F
	5740,5760,5780,5800,5820,5840,5860,5880,
	//R
	5658,5695,5732,5769,5806,5843,5880,5917,
	//L
	5362,5399,5436,5473,5510,5547,5584,5621,
};

/**********************************************************************************************************
*函 数 名: SaveMspVtxParameter(void)
*功能说明: 将图传参数保存到飞控中
*形    参: 无
*返 回 值: 无
**********************************************************************************************************/
void SaveMspVtxParameter(void)
{
    uint32_t Temp;
    
    TargetVTX.Freq = VtxFreqTable[TargetVTX.Channel];
    Temp = (TargetVTX.Channel << 24) | (TargetVTX.PowerLevel << 16) | TargetVTX.Freq;
    paramUpdateData(PARAM_VTX_MSP,&Temp);
}

/**********************************************************************************************************
*函 数 名: GetMspVtxParameter(void)
*功能说明: 获取飞控已保存的VTX参数
*形    参: 无
*返 回 值: 无
**********************************************************************************************************/
void GetMspVtxParameter(void)
{
    uint32_t Temp=0;
    uint16_t ReadErrorFlag=0;
    
    paramGetData(PARAM_VTX_MSP,&Temp,4);
    if((Temp>>24 & 0xff)<=48)
    {
        TargetVTX.Channel = Temp>>24 & 0xff;
    }
    else
    {
        ReadErrorFlag = 1;
    }
    
    if((Temp>>16 & 0xff) > 0 && (Temp>>16 & 0xff)<16)
    {
        TargetVTX.PowerLevel = (Temp>>16 & 0xff);
    }
    else
    {
        ReadErrorFlag = 1;
    }
    if((Temp & 0xffff)> 5000 && (Temp & 0xffff) < 6000 )
    {
        TargetVTX.Freq  = (Temp & 0xffff);
    }
    else
    {
        ReadErrorFlag = 1;
    }
    if(VtxFreqTable[TargetVTX.Channel] != TargetVTX.Freq)
    {
        ReadErrorFlag = 1;
    }

    if(ReadErrorFlag == 1)  //读取有错误，需要加载默认值重新保存。
    {
        TargetVTX.Channel = 32;
        TargetVTX.PowerLevel = 1;
        TargetVTX.Freq = VtxFreqTable[TargetVTX.Channel];
        SaveMspVtxParameter();
    }
    TargetVTX.Band        =  TargetVTX.Channel/8 +1;    //转换到1开始，因为VTX设备从1开始
    TargetVTX.BandChannel = (TargetVTX.Channel)%8+1;    //转换到1开始，因为VTX通道为1-8
}

/**********************************************************************************************************
*函 数 名: uint8_t MspVtxCheckSumBuf(uint8_t Checksum, const uint8_t *Data, int Len)
*功能说明: MSP VTX校验计算
*形    参: Checksum:校验和,*Data：数据指针,Len:需要校验的数据长度
*返 回 值: 无
**********************************************************************************************************/
uint8_t MspVtxCheckSumBuf(uint8_t Checksum, const uint8_t *Data, int Len)
{
    while(Len-- > 0) 
    {
        Checksum ^= *Data++;
    }
    return Checksum;
}

/**********************************************************************************************************
*函 数 名: void MspVtxSetChPower(VTXDataType *Target,uint8_t SetFlag)
*功能说明: 通过MSP协议设置VTX频率、功率。
*形    参: *Target：VTX数据结构体指针，SetFlag：设置标志，0：用于初始化时设置VTX；1：用于正常时刻设置VTX
*返 回 值: 无
*参考1：//https://github.com/OpenVTx/OpenVTx/blob/20dee4eb33c3efa1e29d9fa1b53712815e59f924/src/src/mspVtx.c#L544C26-L544C26
*参考2：//https://github.com/OpenVTx/OpenVTx/blob/20dee4eb33c3efa1e29d9fa1b53712815e59f924/src/src/mspVtx.c#L318
**********************************************************************************************************/
void MspVtxSetChPower(VTXDataType *Target,uint8_t SetFlag)
{
    static uint8_t SendPack[24];
    
    UartDmaSendPack(OSD_UART, FcResponseDisplayport0, 21);

    CurrVTX.Channel     = Target->Channel;
    CurrVTX.Band        = Target->Band;         //转换到1开始，因为VTX设备从1开始
    CurrVTX.BandChannel = Target->BandChannel;  //转换到1开始，因为VTX通道为1-8
    CurrVTX.PowerLevel  = Target->PowerLevel;
    CurrVTX.dbm = CurrVTX.VtxPowerList[Target->PowerLevel-1];
    CurrVTX.Freq = VtxFreqTable[CurrVTX.Channel];
    
    if(SetFlag == InitSetVtx)   //初始化时设置VTX，使用21字节包
    {
        SendPack[0]  = 0x24;
        SendPack[1]  = 0x4D;
        SendPack[2]  = 0x3E;
        SendPack[3]  = 0x0F;    //长度
        SendPack[4]  = 0x58;    //功能
        SendPack[5]  = 0x05; 
        SendPack[6]  = CurrVTX.Band;
        SendPack[7]  = CurrVTX.BandChannel;
        SendPack[8]  = CurrVTX.PowerLevel;
        SendPack[9]  = 0x00;
        SendPack[10] = CurrVTX.Freq & 0xff;
        SendPack[11] = (CurrVTX.Freq >> 8) & 0xff;
        SendPack[12] = 0x01;
        SendPack[13] = 0x00;
        SendPack[14] = 0x00;
        SendPack[15] = 0x00;
        SendPack[16] = 0x01;
        SendPack[17] = 6;
        SendPack[18] = 8;
        SendPack[19] = 5;
        SendPack[20] = MspVtxCheckSumBuf(0,&SendPack[3],20-3);
        UartDmaSendPack(OSD_UART, SendPack, 21);
        FcRequestVtxConfigFlag=4;
    }
    else if(SetFlag == NormalSetVtx)//正常初始化后设置VTX，使用24字节包
    {
        SendPack[0]  = 0x24;
        SendPack[1]  = 0x58;
        SendPack[2]  = 0x3E;
        SendPack[3]  = 0x00;   
        SendPack[4]  = 0x58;    //功能高位
        SendPack[5]  = 0x00;    //功能低位
        SendPack[6]  = 0x0F;    //长度低位
        SendPack[7]  = 0x00;    //长度高位
        SendPack[8]  = 0x05; 
        SendPack[9]  = CurrVTX.Band;
        SendPack[10] = CurrVTX.BandChannel;
        SendPack[11] = CurrVTX.PowerLevel;;
        SendPack[12] = 0x00;
        SendPack[13] = CurrVTX.Freq & 0xff;
        SendPack[14] = (CurrVTX.Freq >> 8) & 0xff;
        SendPack[15] = 0x01;
        SendPack[16] = 0x00;
        SendPack[17] = 0x00;
        SendPack[18] = 0x00;
        SendPack[19] = 0x01;
        SendPack[20] = 6;
        SendPack[21] = 8;
        SendPack[22] = 3;
        SendPack[23] = CalcCRC(&SendPack[3],23-3);
        UartDmaSendPack(OSD_UART, SendPack, 24);
    }

    SaveMspVtxParameter();      //保存VTX信息
    UartDmaSendPack(OSD_UART, FcResponseDisplayport0, 24);
}
/**********************************************************************************************************
*函 数 名: void UnPack_MspVtxBand(void)
*功能说明: 解析来自MSP VTX的band数据包
*形    参: 无
*返 回 值: 无
**********************************************************************************************************/
void UnPack_MspVtxBand(void)
{
    for(uint8_t i=0;i<VtxBandNum;i++)
    {
        for(uint8_t j=0;j<VtxChNum;j++)
        {
            CurrVTX.FreqTable[i][j] = (MspRxVtxBandBuf[i][19+2*j] << 8) | MspRxVtxBandBuf[i][18+2*j];
        }
    }
}

/**********************************************************************************************************
*函 数 名: void UnPack_MspVtxBand(void)
*功能说明: 解析来自MSP VTX的Power数据包
*形    参: 无
*返 回 值: 无
**********************************************************************************************************/
void UnPack_MspVtxPower(void)
{
//    int len=0;
//    uint8_t k=0;
//    char Buf[10];
    for(uint8_t i=0;i<VtxPowerNum;i++)
    {
        CurrVTX.VtxPowerList[i] = MspRxVtxPowerBuf[i][6];
//        for(uint8_t j=0;j<MspRxVtxPowerBuf[i][8];j++)
//        {
//            Buf[j] = MspRxVtxPowerBuf[i][9+j];
//        }
//        len += sprintf(CurrVTX.VtxPowerName+len,"%sMW",Buf);
    }
}

/**********************************************************************************************************
*函 数 名: void Response_STATUS(void)
*功能说明: 解析MSP_STATUS命令，回复FC状态
*形    参: 无
*返 回 值: 无
**********************************************************************************************************/
void Response_STATUS(void)
{
    uint32_t FlightMode;
    static uint8_t  FcStatusBuf[28];
    uint32_t ArmingDisableFlags;
    
    FcStatusBuf[0]  = 0x24;
    FcStatusBuf[1]  = 0x4D;
    FcStatusBuf[2]  = 0x3E;
    FcStatusBuf[3]  = 0x16;
    FcStatusBuf[4]  = MSP_STATUS;
    FcStatusBuf[5]  = 0x00;         //PID循环时间us，低位
    FcStatusBuf[6]  = 0x00;         //PID循环时间us，高位
    FcStatusBuf[7]  = 0x00;         //IIC 错误计数低位
    FcStatusBuf[8]  = 0x00;         //IIC 错误计数高位
    FcStatusBuf[9]  = 0x23;         //传感器低位
    FcStatusBuf[10] = 0x00;         //传感器高位
    
    //获取飞行模式标志
    switch(getFlightMode())
    {
        case MANUAL:    FlightMode = 0x00;break;
        case SPORT:     FlightMode = 0x02;break;
        case NORMAL:      FlightMode = 0x40;break;
        case AUTOLAND:  FlightMode = 0x40;break;
        case TURTLE:      FlightMode = 0x8000;break;
    }
    
    //获取飞控状态
    //获取失控状态，失控状态高于上锁状态
    if(getFailSafeStatus() == true)
    {
        ArmingDisableFlags = 0x04;          //无接收机信号
    }
    else if(getArmedStatus() == DISARMED)   //上锁
    {
        ArmingDisableFlags = 0x80;
    }
    else                                    //解锁
    {
        FlightMode |= 1;
        ArmingDisableFlags = 0x00;
    }
    
    FcStatusBuf[11] = FlightMode;               //飞行模式0-7
    FcStatusBuf[12] = FlightMode>>8;            //飞行模式8-15
    FcStatusBuf[13] = FlightMode>>16;           //飞行模式16-23
    FcStatusBuf[14] = FlightMode>>24;           //飞行模式24-31
    FcStatusBuf[15] = 0x01;                     //current Pid Profile Index
    FcStatusBuf[16] = 0x00;                     //average System Load Percent低位
    FcStatusBuf[17] = 0x00;                     //average System Load Percent高位
    FcStatusBuf[18] = 0x00;                     //pid Profile Count
    FcStatusBuf[19] = 0x00;                     //Current Control Rate Profile Index
    FcStatusBuf[20] = 0x00;                     //byte Count
    FcStatusBuf[21] = 0x1A;                     //ARMING  DISABLE FLAGS COUNT
    
    FcStatusBuf[22] = ArmingDisableFlags;       //arming Disable Flags0-7
    FcStatusBuf[23] = ArmingDisableFlags>>8;    //arming Disable Flags8-15
    FcStatusBuf[24] = ArmingDisableFlags>>16;   //arming Disable Flags16-23
    FcStatusBuf[25] = ArmingDisableFlags>>24;   //arming Disable Flags24-31
    FcStatusBuf[26] = 0x00;                     //reboot Required
    
    FcStatusBuf[27] = MspVtxCheckSumBuf(0,&FcStatusBuf[3],27-3);
    UartDmaSendPack(OSD_UART, FcStatusBuf, 28);
    
}


/**********************************************************************************************************
*函 数 名: void Response_RC(void)
*功能说明: 解析MSP_RC命令，回复RC数据
*形    参: 无
*返 回 值: 无
**********************************************************************************************************/
void Response_RC(void)
{
    uint8_t Ch;
    static uint8_t FcRCBuf[38];
    
    FcRCBuf[0]  = 0x24;
    FcRCBuf[1]  = 0x4D;
    FcRCBuf[2]  = 0x3E;
    FcRCBuf[3]  = 0x16;
    FcRCBuf[4]  = MSP_RC;
    FcRCBuf[5]   = rcData.roll;
    FcRCBuf[6]   = rcData.roll >> 8;
    FcRCBuf[7]   = rcData.pitch;
    FcRCBuf[8]   = rcData.pitch >> 8;
    FcRCBuf[9]   = rcData.throttle;
    FcRCBuf[10]  = rcData.throttle >> 8;
    FcRCBuf[11]  = rcData.yaw;
    FcRCBuf[12]  = rcData.yaw >> 8;
    FcRCBuf[13]  = rcData.aux1;
    FcRCBuf[14]  = rcData.aux1 >> 8;
    FcRCBuf[15]  = rcData.aux2;
    FcRCBuf[16]  = rcData.aux2 >> 8;
    FcRCBuf[17]  = rcData.aux3;
    FcRCBuf[18]  = rcData.aux3 >> 8;
    FcRCBuf[19]  = rcData.aux4;
    FcRCBuf[20]  = rcData.aux4 >> 8;
    FcRCBuf[21]  = rcData.aux5;
    FcRCBuf[22]  = rcData.aux5 >> 8;
    FcRCBuf[23]  = rcData.aux6;
    FcRCBuf[24]  = rcData.aux6 >> 8;
    FcRCBuf[25]  = rcData.aux7;
    FcRCBuf[26]  = rcData.aux7 >> 8;
    FcRCBuf[27]  = rcData.aux8;
    FcRCBuf[28]  = rcData.aux8 >> 8;
    FcRCBuf[29]  = rcData.aux9;
    FcRCBuf[30]  = rcData.aux9 >> 8;
    FcRCBuf[31]  = rcData.aux10;
    FcRCBuf[32]  = rcData.aux10 >> 8;
    FcRCBuf[33]  = rcData.aux11;
    FcRCBuf[34]  = rcData.aux11 >> 8;
    FcRCBuf[35]  = rcData.aux12;
    FcRCBuf[36]  = rcData.aux12 >> 8;
    
    FcRCBuf[37] = MspVtxCheckSumBuf(0,&FcRCBuf[3],37-3);
    UartDmaSendPack(OSD_UART, FcRCBuf, 38);
    
}
volatile uint32_t CPU_RunTime;
/**********************************************************************************************************
*函 数 名: void Response_FwVersion(void)
*功能说明: 解析MSP_FC_VERSION命令，回复FC版本号
*形    参: 无
*返 回 值: 无
**********************************************************************************************************/
void Response_FcFwVersion(void)
{
    static uint8_t FwVersionBuf[9];
    
    FwVersionBuf[0] = 0x24;
    FwVersionBuf[1] = 0x4D;
    FwVersionBuf[2] = 0x3E;
    FwVersionBuf[3] = 0x03;
    FwVersionBuf[4] = MSP_FC_VERSION;
    FwVersionBuf[5] = MAJOR_VERSION;
    FwVersionBuf[6] = MINOR_VERSION;
    FwVersionBuf[7] = PATCH_VERSION;
    FwVersionBuf[8] = MspVtxCheckSumBuf(0,&FwVersionBuf[3],5);
    UartDmaSendPack(OSD_UART, FwVersionBuf, 9);
}

/**********************************************************************************************************
*函 数 名: void Response_FcName(void)
*功能说明: 解析MSP_NAME命令，回复电池信息
*形    参: 无
*返 回 值: 无
**********************************************************************************************************/
void Response_FcName(void)
{
    static uint8_t FcNameBuf[15];
   
    FcNameBuf[0]  = 0x24;
    FcNameBuf[1]  = 0x4D;
    FcNameBuf[2]  = 0x3E;
    FcNameBuf[3]  = 0x09;
    FcNameBuf[4]  = MSP_NAME;
    FcNameBuf[5]  = 'P';
    FcNameBuf[6]  = 'a';
    FcNameBuf[7]  = 'v';
    FcNameBuf[8]  = 'o';
    FcNameBuf[9]  = ' ';
    FcNameBuf[10] = 'P';
    FcNameBuf[11] = 'i';
    FcNameBuf[12] = 'c';
    FcNameBuf[13] = 'o';
    FcNameBuf[14] = MspVtxCheckSumBuf(0,&FcNameBuf[3],11);
    UartDmaSendPack(OSD_UART, FcNameBuf, 15);
}

/**********************************************************************************************************
*函 数 名: void UnPack_BatteryVoltage(void)
*功能说明: 解析MSP_BATTERY_STATE命令，回复电池信息
*形    参: 无
*返 回 值: 无
**********************************************************************************************************/
void Response_BatteryVoltage(void)
{
    static uint8_t BatteryBuf[17];
    
    BatteryBuf[0]  = 0x24;
    BatteryBuf[1]  = 0x4D;
    BatteryBuf[2]  = 0x3E;
    BatteryBuf[3]  = 0x0B;
    BatteryBuf[4]  = MSP_BATTERY_STATE;
    BatteryBuf[5]  = 0x02;//电芯数量
    BatteryBuf[6]  = 0x00;//电池低位容量
    BatteryBuf[7]  = 0x00;//电池高位容量
    BatteryBuf[8]  = (uint8_t)(getBatteryVoltage()*10);//上一时刻电池电压
    BatteryBuf[9]  = 0x00;//已用低位容量
    BatteryBuf[10] = 0x00;//已用高位容量
    BatteryBuf[11] = 0x00;//电流低位，mA
    BatteryBuf[12] = 0x00;//电流高位，mA
    BatteryBuf[13] = getBatteryStatus();//电池状态
    BatteryBuf[14] = ((uint16_t)(getBatteryVoltage()*100));//电压
    BatteryBuf[15] = ((uint16_t)(getBatteryVoltage()*100))>>8;
    BatteryBuf[16] = MspVtxCheckSumBuf(0,&BatteryBuf[3],16-3);
    UartDmaSendPack(OSD_UART, BatteryBuf, 17);
}

/**********************************************************************************************************
*函 数 名: void UnPack_BatteryVoltage(void)
*功能说明: 解析回应MSP_ANALOG命令，
*形    参: 无
*返 回 值: 无
**********************************************************************************************************/
void Response_Analog(void)
{   
    static uint8_t AnalogBuf[15];
    
    AnalogBuf[0]  = 0x24;
    AnalogBuf[1]  = 0x4D;
    AnalogBuf[2]  = 0x3E;
    AnalogBuf[3]  = 0x09;
    AnalogBuf[4]  = MSP_ANALOG;
    AnalogBuf[5]  = (uint8_t)(getBatteryVoltage()*10);//电池电压0.1V
    AnalogBuf[6]  = 0x00;//电池容量低位，单位mAh
    AnalogBuf[7]  = 0x00;//电池容量高位，单位mAh
    AnalogBuf[8]  = 0x00;//RSSI值低位 0-1024对应0%-99%
    AnalogBuf[9]  = 0x00;//RSSI值高位 0-1024对应0%-99%
    AnalogBuf[10] = 0x00;//电流低位，mA
    AnalogBuf[11] = 0x00;//电流高位，mA
    AnalogBuf[12] = ((uint16_t)(getBatteryVoltage()*100));//电压
    AnalogBuf[13] = ((uint16_t)(getBatteryVoltage()*100))>>8;
    AnalogBuf[14] = MspVtxCheckSumBuf(0,&AnalogBuf[3],14-3);
    UartDmaSendPack(OSD_UART, AnalogBuf, 15);
}

/**********************************************************************************************************
*函 数 名: void MspVtxFrameResponse(void)
*功能说明: 解析和回应MSP VTX命令包
*形    参: 无
*返 回 值: 无
**********************************************************************************************************/
void MspVtxFrameResponse(void)
{
    uint16_t i=0;
    uint8_t LastPackLen=0;
    static uint16_t OSD_OpenTime=0;
    
    if(InitFlag == 0)
    {
        GetMspVtxParameter();
        MspVtxRxLen = 0;
        InitFlag = 1;
    }
    if(MspVtxRxLen >6)
    {
        extern uint8_t osdMspReceivedFlag;
        osdMspReceivedFlag = 1;
        switch(MspRxDataBuf[4])
        {
            case MSP_FC_VARIANT:                    //VTX请求获取FC FW名字和请求获取配置
                UartDmaSendPack(OSD_UART, FcResponseFwName, 10);
                if(FcRequestVtxConfigFlag == 0)
                {
                    TargetVTX.Channel=32;
                    TargetVTX.PowerLevel = 1;
                    MspVtxSetChPower(&TargetVTX,InitSetVtx);
                }
            break;
                
            case MSP_FC_VERSION:                    //VTX 请求飞控版本号
                UartDmaSendPack(OSD_UART, FcResponseDisplayport1, 7);//DJI需要发送这个命令才会有OSD显示
                Response_FcFwVersion();
            break;
            
            case MSP_NAME:                          //VTX请求飞控名字
                Response_FcName();
            break;
            
            case MSP_BATTERY_STATE:                 //VTX请求电池状态
                Response_BatteryVoltage();
            break;
            
            case MSP_STATUS:                        //VTX请求电池状态
                Response_STATUS();
            break;
            
            case MSP_RC:                        //VTX请求电池状态
                Response_RC();
            break;
            
            case MSP_ANALOG:                        //VTX请求模拟参数，如电池电压、电流、电池容量等
                Response_Analog();
            break;
                
            case MSP_SET_VTX_CONFIG:                //VTX请求清除当前VTX频点表配置
                RxBandBufNum = 0;
                RxPowerBufNum = 0;
                VtxChNum = MspRxDataBuf[13];
                VtxBandNum = MspRxDataBuf[12];
                VtxPowerNum = MspRxDataBuf[18];
                UartDmaSendPack(OSD_UART, FcResponseClearConfig, 6);
            break;
            
            case MSP_SET_VTXTABLE_BAND:             //VTX请求设置当前VTX频点表配置
                memcpy(MspRxVtxBandBuf[RxBandBufNum++],MspRxDataBuf,35);
                VTX_Type = HD_Zero;
                FcRequestVtxConfigFlag = 0x01;      //标志接收Band完成
                if(RxBandBufNum == VtxBandNum)
                {
                    UnPack_MspVtxBand();
                }
            break;
            
            case MSP_SET_VTXTABLE_POWERLEVEL:       //VTX请求设置当前VTX功率表配置
                memcpy(MspRxVtxPowerBuf[RxPowerBufNum++],MspRxDataBuf,MspVtxRxLen);
                VTX_Type = HD_Zero;
                FcRequestVtxConfigFlag |= 0x02;     //标志接收Power完成
                if(RxPowerBufNum == VtxPowerNum)
                {
                    UnPack_MspVtxPower();
                }
            break;
                
            case MSP_SET_OSD_CANVAS:                //VTX请求设置OSD画布大小
                UartDmaSendPack(OSD_UART, FcResponseCanvas, 6);
            break;
            
            case MSP_EEPROM_WRITE:                  //VTX请求写入配置
                UartDmaSendPack(OSD_UART, FcResponseWriteEP, 6);
            break;
            
            default:
                ;
        }
        //移除已解析的命令
        LastPackLen = MSP_HEADER_SIZE+MspRxDataBuf[3];
        for(i=0;i<MspVtxRxLen;i++)
        {
            MspRxDataBuf[i] = MspRxDataBuf[i+LastPackLen];
        }
        if(MspVtxRxLen>=LastPackLen)
        {
            MspVtxRxLen-=LastPackLen;
        }
        else
        {
            MspVtxRxLen = 0;
        }
    }
}

/**********************************************************************************************************
*函 数 名: void MspVtxReceivedData(uint8_t Data)
*功能说明: 接收MSP VTX命令包
*形    参: Data：8位数据
*返 回 值: 无
**********************************************************************************************************/
void MspVtxReceivedData(uint8_t Data)
{
    if(InitFlag == 1)
    {
        if((Data == 0x24 && MspVtxRxLen == 0) || (MspRxDataBuf[0] == 0x24 && MspVtxRxLen != 0))
        {

            MspRxDataBuf[MspVtxRxLen++] = Data;
        }
        else
        {
            MspVtxRxLen = 0;
        }
    }
}



