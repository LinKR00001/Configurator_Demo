
import axios from 'axios';
import type { AxiosResponse } from 'axios';

// UOM平台基础地址建议配置到环境变量
const UOM_API_BASE_URL = import.meta.env.VITE_UOM_API_BASE_URL || 'https://uom.example.com/api';
const SNAP_TEST_USERS_URL = import.meta.env.DEV
	? '/snap-test/api/user/getAllUsers'
	: 'https://api.snap-test.in/api/user/getAllUsers';
const SNAP_TEST_ADD_USER_URL = import.meta.env.DEV
	? '/snap-test/api/user/addUser/'
	: 'https://api.snap-test.in/api/user/addUser/';

// 查询实名登记状态参数类型
export interface QueryUavRealNameParams {
	id: string;
	body: string;
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
export function queryUavRealNameStatus(params: QueryUavRealNameParams): Promise<AxiosResponse<any>> {
	return axios.post(
		`${UOM_API_BASE_URL}/uav/realname/status`,
		params,
		{ headers: { 'Content-Type': 'application/json;charset=utf-8' } }
	);
}

// 上报激活状态（加密参数）
export function reportUavActivationStatus(params: ReportUavActivationParams): Promise<AxiosResponse<any>> {
	return axios.post(
		`${UOM_API_BASE_URL}/uav/activation/report`,
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
