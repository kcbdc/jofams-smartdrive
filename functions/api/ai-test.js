
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const modelName = url.searchParams.get("model");

  const models = {
    llama: "@cf/meta/llama-3.1-8b-instruct-fp8",
    gemma: "@cf/google/gemma-4-26b-a4b-it"
  };

  if (!Object.hasOwn(models, modelName)) {
    return Response.json(
      { error: "model은 llama 또는 gemma여야 합니다." },
      { status: 400 }
    );
  }

  if (!context.env.AI) {
    return Response.json(
      { error: "AI 바인딩이 없습니다." },
      { status: 503 }
    );
  }

  try {
    const result = await context.env.AI.run(
      models[modelName],
      {
        messages: [
          {
            role: "user",
            content: "안녕하세요. 한국어로 간단히 자기소개해 주세요."
          }
        ],
        max_tokens: 150
      }
    );

    return Response.json({
      model: modelName,
      result
    });
  } catch (error) {
    return Response.json(
      { error: "AI 실행 실패", message: error.message },
      { status: 502 }
    );
  }
}
