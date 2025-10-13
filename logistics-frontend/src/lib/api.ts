"use server";

import axios, { AxiosError } from "axios";
import { auth } from "@/lib/auth";

type Props = {
    endpoint: string;
    method?: "GET" | "POST" | "PUT" | "DELETE";
    data?: object;
    withAuth?: boolean
}

const BASE_URL = process.env.API_URL + "/api/v1";

export const api = async <TypeResponse>({ endpoint, method = "GET", data, withAuth = true }: Props): Promise<API<TypeResponse>> => {
    const session = await auth()
    
    const instance = axios.create({
        baseURL: BASE_URL
    })

    if (withAuth && session?.user.access_token) {
        instance.defaults.headers.common['Authorization'] = `Bearer ${session.user.access_token}`
    }

    try {
        const request = await instance<API<TypeResponse>>(endpoint, {
            method,
            params: method == "GET" && data,
            data: method != "GET" && data
        })

        return request.data
    } catch (error) {
        const e = error as AxiosError<APIError>

        return {
            success: false,
            detail: e.response?.data.detail || "An unexpected error occurred",
            code: e.response?.data.code || "UNKNOWN_ERROR",
            data: null
        }
    }
}