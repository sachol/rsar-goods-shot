
import { GoogleGenAI, Type } from "@google/genai";
import { WorkMode, AnalysisResult, PlacementType, BackgroundType } from "../types.ts";

/**
 * 전역 API 키 관리자
 */
export const getApiKey = () => {
  const savedKey = localStorage.getItem('rsa_custom_api_key');
  return savedKey || process.env.API_KEY || "";
};

export const getGeminiClient = (customKey?: string) => {
  const apiKey = customKey || getApiKey();
  return new GoogleGenAI({ apiKey });
};

/**
 * API 키 유효성 검증 함수
 */
export async function validateApiKey(key: string): Promise<{ success: boolean; message: string }> {
  if (!key || key.trim().length < 10) {
    return { success: false, message: "올바른 형식의 Gemini API 키를 입력해주세요." };
  }
  
  try {
    const testAi = new GoogleGenAI({ apiKey: key.trim() });
    const response = await testAi.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'PING',
      config: { maxOutputTokens: 1 }
    });
    
    if (response && response.text !== undefined) {
      return { success: true, message: "연결 성공: 유효한 API 키입니다." };
    }
    return { success: false, message: "연결 실패: 응답이 없습니다." };
  } catch (e: any) {
    const err = String(e);
    if (err.includes("401")) return { success: false, message: "실패: 유효하지 않은 API 키 (401)" };
    if (err.includes("403")) return { success: false, message: "실패: 차단된 지역이거나 권한 없음 (403)" };
    if (err.includes("429")) return { success: false, message: "실패: 할당량 초과/결제필요 (429)" };
    return { success: false, message: "연결 실패: API 키가 올바르지 않거나 네트워크 오류입니다." };
  }
}

/**
 * 분석 단계: 상세 옵션을 반영하여 지침을 생성합니다.
 */
export async function analyzeProductImage(
  base64Image: string,
  mode: WorkMode,
  placementType: PlacementType = 'PEOPLE',
  backgroundType: BackgroundType = 'INDOOR'
): Promise<AnalysisResult> {
  const ai = getGeminiClient();
  
  let modeSpecificInstruction = "";
  if (mode === 'BACKGROUND') {
    modeSpecificInstruction = backgroundType === 'INDOOR' 
      ? "[실내/스튜디오]: 럭셔리한 실내 인테리어, 고급 쇼룸, 모던한 스튜디오 조명 배경" 
      : "[실외/자연]: 세련된 도심 거리, 햇살이 비치는 야외 정원, 이국적인 자연 풍경 배경";
  } else {
    // 인물 모델 모드 지침 강화: 전신 우선, 얼굴 노출 필수
    modeSpecificInstruction = placementType === 'PEOPLE' 
      ? "[인물 모델]: 전문 패션 모델이 이 상품을 실제 착용하고 있는 프리미엄 화보 스타일. 모델의 전신(full-body)이 나오는 구도를 최우선으로 하되, 상품의 특성상 전신이 어려울 경우 반드시 모델의 얼굴과 상품이 함께 선명하게 보이도록 구성하세요. 모델의 표정과 시선 처리가 자연스러워야 상품의 신뢰도가 높아집니다. 절대로 모델의 얼굴을 자르거나 가리지 마세요." 
      : "[건물/장소]: 현대적인 건축물 외벽, 럭셔리 오피스 로비, 갤러리 벽면 등에 설치/전시된 실제 현장 스타일";
  }

  const prompt = `
    상품 이미지를 정밀 분석하여 화보 스타일 5가지를 제안하세요.
    연출 방향: ${modeSpecificInstruction}
    1. 제목과 설명은 세련된 **한국어**로 작성하세요.
    2. 생성용 프롬프트는 상세한 **영어**로 작성하세요. 
       - 인물 모델일 경우 반드시 'showing full body' 또는 'showing model's face and gaze clearly'와 같은 구체적인 인물 묘사 키워드를 포함하세요.
    반드시 JSON 형식으로만 응답하세요.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/png' } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          productType: { type: Type.STRING },
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                prompt: { type: Type.STRING }
              },
              required: ["id", "title", "description", "prompt"]
            }
          }
        },
        required: ["productType", "suggestions"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

/**
 * 생성 단계
 */
export async function generateStudioShot(
  originalBase64: string,
  stylePrompt: string
): Promise<string> {
  const ai = getGeminiClient();
  
  // 스타일 프롬프트에 인물 관련 보강 키워드 추가 (보조적 수단)
  const enhancedPrompt = stylePrompt.toLowerCase().includes('model') 
    ? `${stylePrompt}. High-end professional fashion photography, showing model's face clearly, trustworthy expression, sharp focus on both product and model.`
    : stylePrompt;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: originalBase64.split(',')[1], mimeType: 'image/png' } },
        { text: `High-end professional commercial photography. ${enhancedPrompt}. Maintain product detail perfectly. Realistic shadows and lighting.` }
      ]
    },
    config: { imageConfig: { aspectRatio: "1:1" } }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("이미지 생성 실패");
}
