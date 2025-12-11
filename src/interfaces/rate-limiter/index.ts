import { Context } from 'koa'
import { HttpStatusCode } from 'axios'
import { User } from '@/interfaces/user'
export type State = {
    user?: User
}

export type Request = Context & {
    state: State
    send: (res: object, status: StatusCode) => void
}

export type StatusCode = HttpStatusCode | string

type Error = {
    error: boolean
    message: string
    code: StatusCode
}
export type RequestError = {
    [key: string]: Error
}

export type Middleware = {
    ctx: Request
    next: () => Promise<void>
    config: {
        excludedPaths?: string[]
    }
}

