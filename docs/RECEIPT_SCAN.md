# Digitalização de recibos (Moondream local)

Extração assistida de dados a partir de fotografias de recibos portugueses. **Nunca cria despesas automaticamente** — o utilizador revê um formulário e confirma explicitamente (incluindo o total).

## Fluxo

1. `/despesas` → **Digitalizar recibo**
2. Câmara ou ficheiro JPEG/PNG
3. Imagem guardada em `storage/documents` (mesmo pipeline que Relatórios)
4. `moondream:latest` via Ollama; se a leitura falhar (total/comerciante inválidos), **fallback automático** para `qwen3.5:4b-mlx` (visão)
5. Reparação determinística (datas em inglês, NIF fantasma, total no campo errado)
6. Validação determinística (datas, montantes, soma de itens vs total)
7. Sugestão de categoria opcional (motor existente de categorização)
8. Checkbox obrigatório + **Registar despesa**

## Duplicados

Após a extração, o servidor compara montante (±0,01 €), data (±3 dias civis) e comerciante normalizado com despesas recentes. Se a pontuação for alta, o formulário exige confirmação explícita antes de criar a despesa.

## Configuração

```bash
ollama pull moondream:latest
```

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_RECEIPT_MODEL=moondream:latest
```

## Limitações

O Moondream é um modelo visual compacto, não OCR contabilístico. Reflexos, texto pequeno, vários totais ou recibos longos degradam a leitura. O total **sempre** exige confirmação manual (`TOTAL_REQUIRES_REVIEW`).

OCR dedicado pode ser adicionado depois atrás do mesmo serviço `extractReceiptFromImage`.

## Ficheiros principais

- `src/lib/finance/receipt-extraction.ts` — normalização e validação
- `src/server/providers/moondream-receipt-extraction.ts` — adaptador Ollama
- `src/server/services/receipt-extraction.ts` — orquestração
- `src/lib/finance/receipt-actions.ts` — actions servidor
- `src/components/expenses/receipt-scan-drawer.tsx` — UI
