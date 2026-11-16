import { z } from "zod"

export const saidaDaMemoriaSchema = z.object({ resumo: z.string() }).strict()
