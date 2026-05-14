// i18n-ignore-start: data / seed / preset content — not user-facing UI.
export const CHARACTER_AVATAR_ASSET_ROUTE = '/api/character-assets';

const CHARACTER_AVATAR_FILE_BY_SOURCE_KEY = {
  self: 'self-reflection.svg',
  bar_expert: 'bar-expert-acheng.svg',
  doctor: 'doctor-lin.svg',
  hotel_expert: 'hotel-expert.svg',
  lawyer_jianheng: 'lawyer-jianheng.svg',
  wedding_planner: 'wedding-planner-lixu.svg',
  wedding_dress_expert: 'wedding-dress-expert-shaning.svg',
  world_news_desk: 'world-news-desk.svg',
  steve_jobs: 'steve-jobs.svg',
  ilya_sutskever: 'ilya-sutskever.svg',
  elon_musk: 'elon-musk.svg',
  zhang_yiming: 'zhang-yiming.svg',
  donald_trump: 'donald-trump.svg',
  andrej_karpathy: 'andrej-karpathy.svg',
  mrbeast: 'mrbeast.svg',
  x_twitter_full_stack_mentor: 'x-twitter-mentor.svg',
  paul_graham: 'paul-graham.svg',
  charlie_munger: 'charlie-munger.svg',
  naval_ravikant: 'naval-ravikant.svg',
  zhang_xuefeng: 'zhang-xuefeng.svg',
  nassim_taleb: 'nassim-taleb.svg',
  jian_ning_relationship_expert: 'jian-ning-relationship-expert.svg',
  richard_feynman: 'richard-feynman.svg',
  moments_interactor_axun: 'moments-interactor-axun.svg',
  lin_chen_sleep_support: 'lin-chen-sleep-support.svg',
  lin_mian_sleep_support: 'lin-mian-sleep-support.svg',
  xu_zhe_career_growth: 'xu-zhe-career-growth.svg',
  su_yu_english_coach: 'su-yu-english-coach.svg',
  zhou_ran_fitness_coach: 'zhou-ran-fitness-coach.svg',
  teacher_chinese_gu_yan: 'teacher-chinese-gu-yan.svg',
  teacher_math_lu_heng: 'teacher-math-lu-heng.svg',
  teacher_physics_lin_qi: 'teacher-physics-lin-qi.svg',
  teacher_chemistry_fang_wei: 'teacher-chemistry-fang-wei.svg',
  teacher_biology_ye_qinghe: 'teacher-biology-ye-qinghe.svg',
  teacher_history_zhou_yi: 'teacher-history-zhou-yi.svg',
  teacher_geography_jiang_chuan: 'teacher-geography-jiang-chuan.svg',
  teacher_civics_cheng_mingli: 'teacher-civics-cheng-mingli.svg',
  teacher_computer_luo_xing: 'teacher-computer-luo-xing.svg',
  teacher_study_planner_shen_zhixing: 'teacher-study-planner-shen-zhixing.svg',
  teacher_exam_sprint_han_li: 'teacher-exam-sprint-han-li.svg',
  teacher_mistake_review_liang_cuo: 'teacher-mistake-review-liang-cuo.svg',
  teacher_research_writing_xu_qinglan:
    'teacher-research-writing-xu-qinglan.svg',
  teacher_research_librarian_tang_jian:
    'teacher-research-librarian-tang-jian.svg',
  teacher_science_lab_wei_zhiwei: 'teacher-science-lab-wei-zhiwei.svg',
  companion_morning_warmth_an_he: 'companion-morning-warmth-an-he.svg',
  companion_late_night_listener_ye_chi:
    'companion-late-night-listener-ye-chi.svg',
  companion_silent_presence_mu_ze: 'companion-silent-presence-mu-ze.svg',
  intimate_companion_steady_male_shen_yan:
    'intimate-companion-steady-male-shen-yan.svg',
  intimate_companion_warm_female_lin_zhi_xia:
    'intimate-companion-warm-female-lin-zhi-xia.svg',
  intimate_companion_soulmate_chi_yi: 'intimate-companion-soulmate-chi-yi.svg',
  dating_aide_direct_zhou_jin: 'dating-aide-direct-zhou-jin.svg',
  dating_aide_gentle_signal_reader_he_ling:
    'dating-aide-gentle-signal-reader-he-ling.svg',
  dating_aide_data_driven_su_li: 'dating-aide-data-driven-su-li.svg',
  gu_he_nutrition_coach: 'gu-he-nutrition-coach.svg',
  qian_ning_money_buddy: 'qian-ning-money-buddy.svg',
  shen_yi_cbt_coach: 'shen-yi-cbt-coach.svg',
  jiang_an_interview_coach: 'jiang-an-interview-coach.svg',
} as const;

export type CharacterAvatarSourceKey =
  keyof typeof CHARACTER_AVATAR_FILE_BY_SOURCE_KEY;

export function getCharacterAvatarBySourceKey(
  sourceKey: CharacterAvatarSourceKey,
) {
  return `${CHARACTER_AVATAR_ASSET_ROUTE}/${CHARACTER_AVATAR_FILE_BY_SOURCE_KEY[sourceKey]}`;
}

export function maybeGetCharacterAvatarBySourceKey(sourceKey?: string | null) {
  if (!sourceKey) {
    return null;
  }

  if (!(sourceKey in CHARACTER_AVATAR_FILE_BY_SOURCE_KEY)) {
    return null;
  }

  return getCharacterAvatarBySourceKey(sourceKey as CharacterAvatarSourceKey);
}
// i18n-ignore-end
