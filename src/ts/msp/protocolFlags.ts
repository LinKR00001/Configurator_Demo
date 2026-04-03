/**
 * 协议开关（类似 C 宏定义）
 *
 * - 调试 MSP 时可将 ENABLE_CUSTOM_PROTOCOL 改为 false。
 * - 需要重新编译/刷新页面后生效。
 */
export const ENABLE_CUSTOM_PROTOCOL = false
export const ENABLE_MSP_PROTOCOL = true

// 打印解析成功的每一帧 MSP 数据（控制台会较多输出）
export const ENABLE_MSP_RX_FRAME_LOG = true

// 固件升级页“升级日志”显示开关
export const ENABLE_FIRMWARE_UPGRADE_LOG = false
// 开发调试页 MSP2 传感器配置读取的串口收发控制台日志开关
export const ENABLE_DEV_PANEL_SERIAL_LOG = true
