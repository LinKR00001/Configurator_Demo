
import axios from 'axios';
import type { AxiosResponse } from 'axios';

// UOM平台基础地址建议配置到环境变量
const UOM_API_BASE_URL = (import.meta.env.VITE_UOM_API_BASE_URL || '').replace(/\/+$/, '');
const SNAP_TEST_USERS_URL = import.meta.env.DEV
	? '/snap-test/api/user/getAllUsers'
	: 'https://api.snap-test.in/api/user/getAllUsers';
const SNAP_TEST_ADD_USER_URL = import.meta.env.DEV
	? '/snap-test/api/user/addUser/'
	: 'https://api.snap-test.in/api/user/addUser/';
const MOCK_REAL_NAME_STATUS_URL = '/mock-uom/realname/status';
const REAL_NAME_STATUS_PATH = '/uav/realname/status';
const ACTIVATION_REPORT_PATH = '/uav/activation/report';

export const hasConfiguredUomApiBaseUrl = Boolean(UOM_API_BASE_URL);
export const mockUomRealNameStatusUrl = MOCK_REAL_NAME_STATUS_URL;
export const configuredUomRealNameStatusUrl = hasConfiguredUomApiBaseUrl
	? `${UOM_API_BASE_URL}${REAL_NAME_STATUS_PATH}`
	: '';

function requireUomApiBaseUrl(): string {
	if (!UOM_API_BASE_URL) {
		throw new Error('未配置 VITE_UOM_API_BASE_URL，无法请求真实 UOM 接口');
	}

	return UOM_API_BASE_URL;
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

export interface QueryUavRealNameStatusResponse {
	code: number;
	msg: string;
	body?: QueryUavRealNameStatusBody;
}

// 上报激活状态参数类型
export interface ReportUavActivationParams {
	id: string;
	encryptedBody: string;
}

export interface SnapTestUser {
	userId: number;
	name: string;
	email: string;
	job: string;
	city: string;
}

export interface SnapTestAddUserPayload {
	name: string;
	email: string;
	job: string;
	city: string;
}

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
export function reportUavActivationStatus(params: ReportUavActivationParams): Promise<AxiosResponse<any>> {
	const baseUrl = requireUomApiBaseUrl();
	return axios.post(
		`${baseUrl}${ACTIVATION_REPORT_PATH}`,
		params,
		{ headers: { 'Content-Type': 'application/json;charset=utf-8' } }
	);
}

export function getSnapTestUsers(): Promise<AxiosResponse<SnapTestUser[]>> {
	return axios.get(SNAP_TEST_USERS_URL);
}

export function addSnapTestUser(payload: SnapTestAddUserPayload): Promise<AxiosResponse<any>> {
	return axios.post(SNAP_TEST_ADD_USER_URL, payload, {
		headers: { 'Content-Type': 'application/json;charset=utf-8' }
	});
}
