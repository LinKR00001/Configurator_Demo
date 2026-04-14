
import axios from 'axios';
import type { AxiosResponse } from 'axios';

// UOM平台基础地址建议配置到环境变量
const UOM_API_BASE_URL = (import.meta.env.VITE_UOM_API_BASE_URL || '').replace(/\/+$/, '');
const MOCK_REAL_NAME_STATUS_URL = '/mock-uom/realname/status';
const MOCK_ACTIVATION_REPORT_URL = '/mock-uom/activation/report';
const MOCK_DEREGISTRATION_URL = '/mock-uom/deregistration';
const REAL_NAME_STATUS_PATH = '/uav/realname/status';
const ACTIVATION_REPORT_PATH = '/uav/activation/report';
const DEREGISTRATION_PATH = (import.meta.env.VITE_UOM_DEREGISTRATION_PATH || '').trim();
const NORMALIZED_DEREGISTRATION_PATH = DEREGISTRATION_PATH
	? (DEREGISTRATION_PATH.startsWith('/') ? DEREGISTRATION_PATH : `/${DEREGISTRATION_PATH}`)
	: '';

export const hasConfiguredUomApiBaseUrl = Boolean(UOM_API_BASE_URL);
export const mockUomRealNameStatusUrl = MOCK_REAL_NAME_STATUS_URL;
export const mockUomActivationReportUrl = MOCK_ACTIVATION_REPORT_URL;
export const mockUomDeregistrationUrl = MOCK_DEREGISTRATION_URL;
export const configuredUomRealNameStatusUrl = hasConfiguredUomApiBaseUrl
	? `${UOM_API_BASE_URL}${REAL_NAME_STATUS_PATH}`
	: '';
export const configuredUomActivationReportUrl = hasConfiguredUomApiBaseUrl
	? `${UOM_API_BASE_URL}${ACTIVATION_REPORT_PATH}`
	: '';
export const hasConfiguredUomDeregistrationApi = Boolean(UOM_API_BASE_URL && NORMALIZED_DEREGISTRATION_PATH);
export const configuredUomDeregistrationUrl = hasConfiguredUomDeregistrationApi
	? `${UOM_API_BASE_URL}${NORMALIZED_DEREGISTRATION_PATH}`
	: '';

function requireUomApiBaseUrl(): string {
	if (!UOM_API_BASE_URL) {
		throw new Error('未配置 VITE_UOM_API_BASE_URL，无法请求真实 UOM 接口');
	}

	return UOM_API_BASE_URL;
}

function requireUomDeregistrationUrl(): string {
	if (!hasConfiguredUomDeregistrationApi) {
		throw new Error('未配置 VITE_UOM_DEREGISTRATION_PATH，无法请求真实注销登记接口');
	}

	return configuredUomDeregistrationUrl;
}

// 查询实名登记状态参数类型
export interface QueryUavRealNameParams {
	id: string;
	body: string;
}

export interface QueryUavRealNamePlainParams {
	UPIC_MSN: string;
}

export interface QueryUavRealNameStatusBody {
	name: string;
	value: string;
}

export interface UomActionResponse<TBody = QueryUavRealNameStatusBody> {
	code: number;
	msg: string;
	body?: TBody;
}

export type QueryUavRealNameStatusResponse = UomActionResponse<QueryUavRealNameStatusBody>;

// 上报激活状态参数类型
export interface ReportUavActivationPlainParams {
	UPIC_MSN: string;
	STATE: string;
}

export interface ReportUavActivationBody {
	token: string;
	value: string;
}

export interface ReportUavActivationParams {
	id: string;
	body: string;
}

export type ReportUavActivationResponse = UomActionResponse<ReportUavActivationBody>;

export interface DeregisterUavPlainParams {
	TOKEN: string;
	TYPE: string;
	REASON: string;
}

export interface DeregisterUavBody {
	name: string;
	value: string;
}

export interface DeregisterUavParams {
	id: string;
	body: string;
}

export type DeregisterUavResponse = UomActionResponse<DeregisterUavBody>;

// 查询实名登记状态
export function queryUavRealNameStatus(params: QueryUavRealNameParams): Promise<AxiosResponse<QueryUavRealNameStatusResponse>> {
	const baseUrl = requireUomApiBaseUrl();
	return axios.post(
		`${baseUrl}${REAL_NAME_STATUS_PATH}`,
		params,
		{ headers: { 'Content-Type': 'application/json;charset=utf-8' } }
	);
}

export function queryMockUavRealNameStatus(params: QueryUavRealNameParams): Promise<AxiosResponse<QueryUavRealNameStatusResponse>> {
	return axios.post(MOCK_REAL_NAME_STATUS_URL, params, {
		headers: { 'Content-Type': 'application/json;charset=utf-8' }
	});
}

// 上报激活状态（加密参数）
export function reportUavActivationStatus(params: ReportUavActivationParams): Promise<AxiosResponse<ReportUavActivationResponse>> {
	const baseUrl = requireUomApiBaseUrl();
	return axios.post(
		`${baseUrl}${ACTIVATION_REPORT_PATH}`,
		params,
		{ headers: { 'Content-Type': 'application/json;charset=utf-8' } }
	);
}

export function reportMockUavActivationStatus(params: ReportUavActivationParams): Promise<AxiosResponse<ReportUavActivationResponse>> {
	return axios.post(MOCK_ACTIVATION_REPORT_URL, params, {
		headers: { 'Content-Type': 'application/json;charset=utf-8' }
	});
}

export function deregisterUav(params: DeregisterUavParams): Promise<AxiosResponse<DeregisterUavResponse>> {
	return axios.post(requireUomDeregistrationUrl(), params, {
		headers: { 'Content-Type': 'application/json;charset=utf-8' }
	});
}

export function deregisterMockUav(params: DeregisterUavParams): Promise<AxiosResponse<DeregisterUavResponse>> {
	return axios.post(MOCK_DEREGISTRATION_URL, params, {
		headers: { 'Content-Type': 'application/json;charset=utf-8' }
	});
}
