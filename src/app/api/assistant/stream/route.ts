import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import {
  openOllamaAnswerStream,
  prepareFinancialAssistantStream,
} from "@/server/services/financial-assistant-stream";

export async function POST(request: Request) {
  await ensureRequestDynamic();
  const user = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Inicia sessão para usar o assistente." }, { status: 401 });
  }

  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) {
    return NextResponse.json({ ok: false, error: "Seleciona primeiro um workspace." }, { status: 400 });
  }

  let question = "";
  try {
    const body = (await request.json()) as { question?: string };
    question = typeof body.question === "string" ? body.question.trim() : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }

  if (question.length < 4 || question.length > 500) {
    return NextResponse.json(
      { ok: false, error: "Escreve uma pergunta válida (4–500 caracteres)." },
      { status: 400 },
    );
  }

  const prepared = await prepareFinancialAssistantStream(user.id, selected.id, question);
  if (!prepared.ok) {
    return NextResponse.json(prepared, { status: 400 });
  }

  try {
    const ollama = await openOllamaAnswerStream(prepared.answer);
    const meta = JSON.stringify({
      evidence: prepared.evidence,
      links: prepared.links,
      intent: prepared.intent,
      confidence: prepared.confidence,
      dataIncomplete: prepared.dataIncomplete ?? false,
    });

    const encoder = new TextEncoder();
    const metaBytes = encoder.encode(`\n\n[[FINTWIN_META:${meta}]]`);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = ollama.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const chunk = JSON.parse(line) as { message?: { content?: string } };
                if (chunk.message?.content) {
                  controller.enqueue(encoder.encode(chunk.message.content));
                }
              } catch {
                // ignora linhas parciais do protocolo Ollama
              }
            }
          }
          controller.enqueue(metaBytes);
        } catch {
          controller.enqueue(encoder.encode(prepared.answer));
          controller.enqueue(metaBytes);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    const encoder = new TextEncoder();
    const meta = JSON.stringify({
      evidence: prepared.evidence,
      links: prepared.links,
      intent: prepared.intent,
      confidence: prepared.confidence,
      dataIncomplete: prepared.dataIncomplete ?? false,
    });
    const body = encoder.encode(`${prepared.answer}\n\n[[FINTWIN_META:${meta}]]`);
    return new Response(body, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
