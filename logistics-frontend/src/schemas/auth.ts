import {z} from 'zod'

export const loginSchema = z.object({
    email: z.string({ required_error: 'O email é obrigatório.' }).email("Email inválido"),
    password: z.string({required_error: 'A senha é obrigatória.'}).min(8, "Senha deve ter pelo menos 8 caracteres.")
})

export type SignInForm = z.infer<typeof loginSchema>