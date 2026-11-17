import { depsReais } from "@/app/_lib/deps"
import { rotasDoVoce } from "@/app/_rotas/voce"

export const GET = rotasDoVoce(depsReais()).lerVoce
