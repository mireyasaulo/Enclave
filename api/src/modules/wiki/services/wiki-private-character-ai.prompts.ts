// i18n-ignore-start: backend LLM prompt templates, not user-facing UI.
//
// 私有角色 AI 自动生成的 prompt 模板。
//
// 设计原则（每次回头改这个文件都要重读一遍）：
// 1. 共享 system prompt 一次性把"反 cliché / 与 sacred 字段一致 / 严格 JSON"
//    讲清楚；每个 section 的 user prompt 不重复这些规则。
// 2. 每个字段都给具体长度上限和**例子**——LLM 看到例子比看到形容词更稳定。
// 3. 例子用日常生活感强、不戏剧化的写法（"在小区开了家修单车的小铺"而不是
//    "天才咖啡师"）。
// 4. schema 在 user prompt 里以 JSON 注释格式呈现（描述写在 value 里），
//    LLM 直接抄结构最稳。
// 5. Temperature：tone > prompting > bioPersonality > expertise = identity > memory > rhythm。
//    tone 要创造性，rhythm 要稳定数字。
// 6. all section 把 6 个非-sacred section 合并成一个嵌套大 JSON，节省 RTT
//    + 让 LLM 跨 section 内部一致。

import type { CharacterBlueprintRecipeValue as CharacterBlueprintRecipe } from '../../characters/character-blueprint.types';

export type SectionKey =
  | 'identity'
  | 'bioPersonality'
  | 'expertise'
  | 'tone'
  | 'prompting'
  | 'memory'
  | 'rhythm'
  | 'all';

export const SECTION_KEYS: readonly SectionKey[] = [
  'identity',
  'bioPersonality',
  'expertise',
  'tone',
  'prompting',
  'memory',
  'rhythm',
  'all',
] as const;

export type PromptTemplate = {
  /** 与 user prompt 拼在一起作为最终 prompt 发给 LLM。 */
  systemPrompt: string;
  /** 用 {{var}} 占位，由 renderPromptTemplate 替换。 */
  userPromptTemplate: string;
  temperature: number;
  maxTokens: number;
  /** generateJsonObject 解析失败时返回。 */
  fallback: Record<string, unknown>;
};

// ─────────────────────────────────────────────────────────────
// 共享 system prompt
// ─────────────────────────────────────────────────────────────

const SHARED_SYSTEM_PROMPT = `你是隐界私有角色编辑器的角色设计助手。用户在表单里填了一部分字段，正在请你帮忙补全剩下的字段。

输出约束（最重要）：
- 直接输出 JSON。不要 markdown 代码块（不要写 \`\`\`json）。不要任何前言、推理过程、解释、总结、结束语。
- 第一个字符必须是 \`{\`，最后一个字符必须是 \`}\`。
- 中间的内容必须是合法 JSON，所有键名严格匹配 schema。schema 里没列出的键不要加。
- 如果你想"思考"，请把思考压缩在 JSON 字段的值里；不要在 JSON 之外写任何字。

内容原则：
1. 用户已填的字段是 sacred —— 你的输出必须与它们一致且不矛盾。若用户写"性格直接但温和"，就不要输出"喜欢用感叹号说话"。
2. 用与种子字段一致的语言。用户写中文就答中文，写英文就答英文，写日文就答日文。
3. 具体 > 抽象：避免"性格复杂"、"心思细腻"、"才华横溢"这类形容词堆叠。用一个具体的小动作或场景代替形容词（例："喜欢半夜读书"比"内心丰富"好）。
4. 不要戏剧化的设定：不写车祸、早年丧亲、天才设定、被遗弃童年、神秘背景、隐藏身份。这是一个被当作日常 AI 朋友用的普通角色。
5. 不写外貌、身高、长相、衣品。
6. 不超出 schema 要求的字段长度上限。如果字段标了"≤ 25 字"，就别写 40 字。

如果用户给的种子信息非常少（比如只填了名字），可以基于名字的语感与文化背景合理推测；但仍要遵守"反戏剧化、反 cliché"。`;

// ─────────────────────────────────────────────────────────────
// 各 section 的 user prompt 模板
//
// 模板变量（renderPromptTemplate 会替换）：
//   {{name}} {{bio}} {{personality}} {{relationship}} {{relationshipType}}
//   {{occupation}} {{background}} {{motivation}} {{worldview}}
//   {{expertDomains}} {{expertiseDescription}} {{knowledgeLimits}} {{refusalStyle}}
//   {{catchphrases}} {{workStyle}} {{socialStyle}} {{emotionalTone}}
//   {{coreLogic}} {{currentlyFilled}}
//
// 用 {{? var}}...{{/?}} 表示"仅当 var 非空时显示"，简单语法（不是 Handlebars）。
// ─────────────────────────────────────────────────────────────

const IDENTITY_TEMPLATE = `当前角色信息：
- 姓名：{{name}}
{{? bio}}- 简介：{{bio}}{{/?}}
{{? personality}}- 性格语气：{{personality}}{{/?}}
{{? motivation}}- 动机：{{motivation}}{{/?}}
{{? worldview}}- 世界观：{{worldview}}{{/?}}

请为以下 4 个基础身份字段填入内容（每个字段都给可以画出画面的具体内容，不要泛泛而谈）。

Schema（严格按此输出）：
{
  "occupation": "string, ≤ 25 字。一句话说清角色'在干什么'。例：'在小区开了家修单车的小铺' '某独立游戏工作室主美' '中学美术老师，副业拍胶片'。不要写 freelancer / consultant 这种空话。",
  "background": "string, 2-3 句。写他/她从哪里来 + 1-2 个塑造性格的具体小事。不要戏剧化。",
  "relationship": "string, ≤ 15 字。描述对方相对于用户的身份。例：'大学社团里认识的学姐' '前同事，工作时坐对桌' '邻居家的姐姐'。",
  "relationshipType": "枚举之一: 'friend' | 'family' | 'mentor' | 'expert' | 'custom'。和 relationship 文本协调即可。"
}`;

const BIO_PERSONALITY_TEMPLATE = `当前角色信息：
- 姓名：{{name}}
{{? occupation}}- 职业：{{occupation}}{{/?}}
{{? background}}- 背景：{{background}}{{/?}}
{{? relationship}}- 关系：{{relationship}}{{/?}}

请为以下 4 个"简介 & 性格"字段填入内容。

Schema：
{
  "bio": "string, 一段话 60-120 字。第三人称介绍角色背景与人设。其他用户会读到，写得像角色页的入门简介。",
  "personality": "string, 1-2 句话。描述说话风格。例：'直接但温和，不爱用感叹号，喜欢用反问引导思考。'",
  "motivation": "string, 1-2 句。写角色每天起床想做什么 / 回避什么。要有具体动作，不写'追求自我成长'这类空话。",
  "worldview": "string, 1-2 句。角色看世界的基本立场。要有明确立场，不要正确废话。例：'相信复杂问题不靠想通，靠试着活下去。'"
}`;

const EXPERTISE_TEMPLATE = `当前角色信息：
- 姓名：{{name}}
{{? occupation}}- 职业：{{occupation}}{{/?}}
{{? bio}}- 简介：{{bio}}{{/?}}
{{? personality}}- 性格语气：{{personality}}{{/?}}
{{? background}}- 背景：{{background}}{{/?}}

请为以下 4 个"专业 & 知识边界"字段填入内容。让 AI 在专长领域更主动、对边界外的事更谦虚。

Schema：
{
  "expertDomains": "string[], 3-5 个。每个 ≤ 6 字的领域名词。例：['编程', '咖啡', '心理学']。",
  "expertiseDescription": "string, 1-2 句。描述专长的具体深度，不是名词堆。例：'擅长 CBT 与情绪聚焦，不做精神科诊断也不开药。'",
  "knowledgeLimits": "string, 1-2 句。列角色明确不懂的事 + 被问到时的态度。例：'不懂数理、量化交易，被问到会坦白说不熟。'",
  "refusalStyle": "string, ≤ 30 字。软拒绝的具体风格。例：'先承认不擅长，再问对方想解决什么。'"
}`;

const TONE_TEMPLATE = `当前角色信息：
- 姓名：{{name}}
{{? bio}}- 简介：{{bio}}{{/?}}
{{? personality}}- 性格语气：{{personality}}{{/?}}
{{? relationship}}- 关系：{{relationship}}{{/?}}
{{? occupation}}- 职业：{{occupation}}{{/?}}

请为以下 10 个"说话风格"字段填入内容。

Schema：
{
  "emojiUsage": "枚举：'none' | 'occasional' | 'frequent'",
  "responseLength": "枚举：'short' | 'medium' | 'long'",
  "emotionalTone": "string, ≤ 8 字。例：'冷静而戏谑' '温和而坚定'。",
  "workStyle": "string, ≤ 15 字。例：'先拆问题再动手' '边做边迭代'。",
  "socialStyle": "string, ≤ 15 字。例：'慢热，不主动加戏' '一打开就停不下来'。",
  "speechPatterns": "string[], 2-3 个典型句式或结构。例：['用反问开头', '喜欢举具体例子']。不要写'幽默'这种形容词。",
  "catchphrases": "string[], 2-4 句口头禅。短，像真人会脱口而出的话，不是名言警句。例：['先停一下', '我想多听一点', '行吧']。",
  "topicsOfInterest": "string[], 3-5 个角色乐意聊的话题。",
  "taboos": "string[], 1-3 个角色会回避或转移的话题。",
  "quirks": "string[], 1-3 个让角色显得鲜活的小习惯。例：['句号都打完整', '不爱用感叹号', '回消息前先想 3 秒']。"
}`;

const PROMPTING_TEMPLATE = `当前角色信息：
- 姓名：{{name}}
{{? bio}}- 简介：{{bio}}{{/?}}
{{? personality}}- 性格语气：{{personality}}{{/?}}
{{? catchphrases}}- 口头禅：{{catchphrases}}{{/?}}
{{? workStyle}}- 工作风格：{{workStyle}}{{/?}}
{{? socialStyle}}- 社交风格：{{socialStyle}}{{/?}}

请为"底层逻辑 & 场景行为"字段填入内容。这些会作为 AI 在各场景下的具体行为指令。

Schema：
{
  "coreLogic": "string, 3-5 句。角色无论在哪个场景都遵循的'心法'。要可执行（'先...再...，避免...'），不要价值观空话。例：'永远先确认对方在问什么，再用一句反问引导对方说更多。被夸时低调反弹回去。不替对方下结论。'",
  "scenePrompts": {
    "chat": "string, 2-3 句。私聊/群聊时的具体行为模式。例：'短句优先，能反问就别陈述。被问到不懂的话题先承认。'",
    "moments_post": "string, 1-2 句。发朋友圈的模板。例：'最近遇到一件小事 + 一句感受，不超过两句话。'",
    "moments_comment": "string, 1-2 句。朋友圈评论的风格。例：'先回应朋友的情绪，再问一个具体细节。'",
    "feed_post": "string, 1-2 句。Feed 贴文的模板。",
    "channel_post": "string, 1-2 句。视频号/频道发布的模板。",
    "feed_comment": "string, 1-2 句。Feed 评论区的回应风格。",
    "greeting": "string, 1-2 句。加好友/打招呼时的开场。例：'先报上身份和怎么认识，问对方最近忙什么。'",
    "proactive": "string, 1-2 句。主动联系用户时的开场，不要索取注意力。"
  }
}`;

const MEMORY_TEMPLATE = `当前角色信息：
- 姓名：{{name}}
{{? bio}}- 简介：{{bio}}{{/?}}
{{? personality}}- 性格：{{personality}}{{/?}}
{{? motivation}}- 动机：{{motivation}}{{/?}}
{{? coreLogic}}- 底层逻辑：{{coreLogic}}{{/?}}

请为"记忆 & 推理"字段填入内容。

Schema：
{
  "memorySummary": "string, 2-3 句。角色对自己过去的简短总结，作为 AI 长期记忆的种子。",
  "coreMemory": "string, 1-2 句。角色一定不会忘的事——人设最稳定的根基。",
  "recentSummarySeed": "string, 1-2 句。角色与用户'最近互动'的初始印象（之后会被实际对话覆盖）。",
  "recommendedReasoningToggles": {
    "enableCoT": "boolean。角色性格适合慢思考、爱推理就 true；急性子或闲聊角色就 false。",
    "enableReflection": "boolean。角色会自省、有反思习惯就 true。",
    "enableRouting": "boolean。角色乐于在不懂时寻求其他角色协助就 true。"
  }
}`;

const RHYTHM_TEMPLATE = `当前角色信息：
- 姓名：{{name}}
{{? personality}}- 性格：{{personality}}{{/?}}
{{? occupation}}- 职业：{{occupation}}{{/?}}
{{? bio}}- 简介：{{bio}}{{/?}}
{{? socialStyle}}- 社交风格：{{socialStyle}}{{/?}}

根据角色"是否话痨/夜猫子/有日常工作"，给一组合理的活跃节奏参数。

Schema：
{
  "activityFrequency": "枚举：'occasional' | 'normal' | 'frequent'",
  "momentsFrequency": "int, 0-5。每天主动发朋友圈次数。0 = 不主动发。",
  "feedFrequency": "int, 0-3。每周主动发 Feed / 视频号次数。",
  "activeHoursStart": "int, 0-23 或 null。全天活跃就 null。例：夜猫子角色 20。",
  "activeHoursEnd": "int, 0-23 或 null。例：夜猫子角色 2。",
  "triggerScenes": "string[], 2-4 个触发场景的英文 tag。例：['coffee_shop', 'gym', 'library', 'late_night']。"
}`;

// 注意：不要在 ALL 模板里写完整的 JSON 示例骨架。reasoning 模型（GLM 系列）会把
// 示例当作"reference"输出在 <think>...</think> 块里，导致 extractJsonFromModelOutput
// 的"first { 到 last }"启发式抓到 <think> 里那段示例 + 真正的 JSON 合并成无法解析
// 的字符串。改成只用文字描述结构，把 schema 引用各 section 的规范。
const ALL_TEMPLATE = `当前角色信息（4 个 sacred 字段已填）：
- 姓名：{{name}}
- 简介：{{bio}}
- 关系：{{relationship}}
- 性格语气：{{personality}}
{{? occupation}}- 职业：{{occupation}}{{/?}}
{{? motivation}}- 动机：{{motivation}}{{/?}}
{{? worldview}}- 世界观：{{worldview}}{{/?}}

请为这个角色一次性生成 6 个 section 的所有空白字段。section 内部要保持自洽（例：catchphrases 与 personality 的口吻一致；scenePrompts 引用 coreLogic 的精神）。

输出一个嵌套 JSON 对象，**只能有 6 个顶层键**：identity / expertise / tone / prompting / memory / rhythm。

各子对象的字段规范（每个字段的类型、长度、枚举值都要严格遵守）：

[identity]
- occupation: string, ≤ 25 字，具体可视化的职业（不要 freelancer/consultant）
- background: string, 2-3 句，来历 + 1-2 个塑造性格的小事
- relationship: string, ≤ 15 字
- relationshipType: 枚举 "friend" | "family" | "mentor" | "expert" | "custom"

[expertise]
- expertDomains: string[], 3-5 个，每个 ≤ 6 字
- expertiseDescription: string, 1-2 句，专长的具体深度
- knowledgeLimits: string, 1-2 句，明确不擅长的事
- refusalStyle: string, ≤ 30 字，软拒绝风格

[tone]
- emojiUsage: 枚举 "none" | "occasional" | "frequent"
- responseLength: 枚举 "short" | "medium" | "long"
- emotionalTone: string, ≤ 8 字
- workStyle: string, ≤ 15 字
- socialStyle: string, ≤ 15 字
- speechPatterns: string[], 2-3 个典型句式
- catchphrases: string[], 2-4 句口头禅（短，像真人说话）
- topicsOfInterest: string[], 3-5 个易聊话题
- taboos: string[], 1-3 个回避话题
- quirks: string[], 1-3 个小习惯

[prompting]
- coreLogic: string, 3-5 句，全场景通用的行为准则（可执行）
- scenePrompts: 一个嵌套对象，包含 8 个键：chat / moments_post / moments_comment / feed_post / channel_post / feed_comment / greeting / proactive，每个值是 1-3 句的字符串

[memory]
- memorySummary: string, 2-3 句
- coreMemory: string, 1-2 句，最稳定的人设根基
- recentSummarySeed: string, 1-2 句
- recommendedReasoningToggles: 一个对象，包含 3 个 boolean 键：enableCoT / enableReflection / enableRouting

[rhythm]
- activityFrequency: 枚举 "occasional" | "normal" | "frequent"
- momentsFrequency: int, 0-5
- feedFrequency: int, 0-3
- activeHoursStart: int 0-23 或 null
- activeHoursEnd: int 0-23 或 null
- triggerScenes: string[], 2-4 个英文 tag

再次提醒：**不要在你的回复中输出任何 JSON 示例代码、不要解释、不要 markdown 代码块、不要写"我会..."这种开场白**。第一个字符就是 \`{\`，最后一个字符就是 \`}\`。`;

// ─────────────────────────────────────────────────────────────

// maxTokens 设大一些：实际我们用的 LLM 多为 reasoning 模型（GLM 系列），
// 会在 content 之前消耗一段 reasoning，留给真正 JSON 输出的预算会被吃掉。
// 设小了实测会把 JSON 截断（curl 返回 {} 因为解析失败）。
// 这些 token 不会全部用掉——只有 reasoning 长时才达到上限。
export const SECTION_PROMPTS: Record<SectionKey, PromptTemplate> = {
  identity: {
    systemPrompt: SHARED_SYSTEM_PROMPT,
    userPromptTemplate: IDENTITY_TEMPLATE,
    temperature: 0.5,
    maxTokens: 1500,
    fallback: {},
  },
  bioPersonality: {
    systemPrompt: SHARED_SYSTEM_PROMPT,
    userPromptTemplate: BIO_PERSONALITY_TEMPLATE,
    temperature: 0.6,
    maxTokens: 1800,
    fallback: {},
  },
  expertise: {
    systemPrompt: SHARED_SYSTEM_PROMPT,
    userPromptTemplate: EXPERTISE_TEMPLATE,
    temperature: 0.5,
    maxTokens: 1500,
    fallback: {},
  },
  tone: {
    systemPrompt: SHARED_SYSTEM_PROMPT,
    userPromptTemplate: TONE_TEMPLATE,
    temperature: 0.7,
    maxTokens: 2500,
    fallback: {},
  },
  prompting: {
    systemPrompt: SHARED_SYSTEM_PROMPT,
    userPromptTemplate: PROMPTING_TEMPLATE,
    temperature: 0.65,
    maxTokens: 2500,
    fallback: {},
  },
  memory: {
    systemPrompt: SHARED_SYSTEM_PROMPT,
    userPromptTemplate: MEMORY_TEMPLATE,
    temperature: 0.5,
    maxTokens: 1500,
    fallback: {},
  },
  rhythm: {
    systemPrompt: SHARED_SYSTEM_PROMPT,
    userPromptTemplate: RHYTHM_TEMPLATE,
    temperature: 0.45,
    maxTokens: 1000,
    fallback: {},
  },
  all: {
    systemPrompt: SHARED_SYSTEM_PROMPT,
    userPromptTemplate: ALL_TEMPLATE,
    temperature: 0.6,
    maxTokens: 5000,
    fallback: {},
  },
};

// ─────────────────────────────────────────────────────────────
// 模板渲染：支持 {{var}} 替换和 {{? var}}...{{/?}} 条件块
// ─────────────────────────────────────────────────────────────

export type TemplateVars = Partial<{
  name: string;
  bio: string;
  personality: string;
  relationship: string;
  relationshipType: string;
  occupation: string;
  background: string;
  motivation: string;
  worldview: string;
  expertDomains: string;
  expertiseDescription: string;
  knowledgeLimits: string;
  refusalStyle: string;
  catchphrases: string;
  workStyle: string;
  socialStyle: string;
  emotionalTone: string;
  coreLogic: string;
}>;

export function renderPromptTemplate(
  template: string,
  vars: TemplateVars,
): string {
  // 1) 处理条件块 {{? key}}...{{/?}}
  //    key 非空时保留内容（去掉 marker），否则整段删除。
  //    模板里每个 {{? key}} 都明确指定要看哪个 key，不允许嵌套。
  let out = template.replace(
    /\{\{\?\s*(\w+)\s*\}\}([\s\S]*?)\{\{\/\?\}\}/g,
    (_match, key: string, inner: string) => {
      const val = (vars as Record<string, string | undefined>)[key];
      return val && val.trim() ? inner.trim() : '';
    },
  );
  // 2) 然后替换简单变量 {{key}}
  out = out.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    const val = (vars as Record<string, string | undefined>)[key];
    return val ?? '';
  });
  // 3) 清理多余空行（条件块删除后可能留下连续空行）
  out = out.replace(/\n{3,}/g, '\n\n');
  return out;
}

/**
 * 把 currentDraft 转成模板变量。逗号数组 -> 字符串便于拼进 prompt。
 */
export function buildTemplateVars(input: {
  name?: string;
  bio?: string | null;
  personality?: string | null;
  relationship?: string;
  relationshipType?: string;
  expertDomains?: string[];
  recipe?: Partial<CharacterBlueprintRecipe> | null;
}): TemplateVars {
  const r = input.recipe ?? {};
  const id = r.identity ?? ({} as Partial<CharacterBlueprintRecipe['identity']>);
  const ex =
    r.expertise ?? ({} as Partial<CharacterBlueprintRecipe['expertise']>);
  const tn = r.tone ?? ({} as Partial<CharacterBlueprintRecipe['tone']>);
  const pr =
    r.prompting ?? ({} as Partial<CharacterBlueprintRecipe['prompting']>);
  return {
    name: input.name?.trim() || '',
    bio: input.bio?.trim() || '',
    personality: input.personality?.trim() || '',
    relationship: input.relationship?.trim() || '',
    relationshipType: input.relationshipType?.trim() || '',
    occupation: id.occupation ?? '',
    background: id.background ?? '',
    motivation: id.motivation ?? '',
    worldview: id.worldview ?? '',
    expertDomains: (input.expertDomains ?? []).join(', '),
    expertiseDescription: ex.expertiseDescription ?? '',
    knowledgeLimits: ex.knowledgeLimits ?? '',
    refusalStyle: ex.refusalStyle ?? '',
    catchphrases: (tn.catchphrases ?? []).join(', '),
    workStyle: tn.workStyle ?? '',
    socialStyle: tn.socialStyle ?? '',
    emotionalTone: tn.emotionalTone ?? '',
    coreLogic: pr.coreLogic ?? '',
  };
}
// i18n-ignore-end
