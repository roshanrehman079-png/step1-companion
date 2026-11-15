// Everything Dr. Mochi says lives here. Edit freely; no code changes needed.
// {name} is replaced with Azka's name, {cat} with the cat's name (e.g. "Dr. Mochi").

export type MochiMoment =
  | 'morning' | 'okay' | 'motivated' | 'bored' | 'distracted' | 'overwhelmed' | 'tired' | 'rest'
  | 'practiceDay' | 'readingDay' | 'examDay' | 'reviewDay' | 'recoveryDay'
  | 'water' | 'pet' | 'nudge' | 'goalMet' | 'logged' | 'welcomeBack' | 'levelUp' | 'cheer' | 'focus'

export const LINES: Record<MochiMoment, string[]> = {
  morning: ['Morning, {name}! How are you feeling?', 'Hi {name}. How are we feeling today?'],
  motivated: ["Love that energy. Full plan today, and breaks still count."],
  okay: ['Okay is good. Normal plan, regular breaks.'],
  bored: ["Let's cut today into small pieces so it feels lighter."],
  distracted: ["Just the next 25 minutes. I'll hide the rest."],
  overwhelmed: ["Just one small step. Ten minutes. I'm right here."],
  tired: ['A light day is still a day. Recall or rest, both count.'],
  rest: ['Resting counts too. Nothing gets added to tomorrow.'],
  practiceDay: ['Practice day. Start at number 1.', 'Question day! One block at a time.'],
  readingDay: ['Reading day. No UWorld today, on purpose.'],
  examDay: ['Practice exam today. Timed, one sitting. You can do this.'],
  reviewDay: ['Review day. Go slowly, learn from every miss.'],
  recoveryDay: ['Recovery day. Rest first, anything else is a bonus.'],
  water: ['Sip sip, thank you.', 'Refreshing! Purr.', 'Good call. Water helps you think.'],
  pet: ['Purr. Again?', 'That tickles!', 'Mrrp. I like it when you visit.'],
  nudge: ['Want to do ten minutes together?', 'Just one small step? I\'ll keep you company.'],
  goalMet: ['You did it! Rest is part of it too.', "Goal done. I'm so proud of you."],
  logged: ['Saved. Nice work.', 'Got it. One step closer.'],
  welcomeBack: ['There you are! Ready when you are.', 'Missed you. Shall we start small?'],
  levelUp: ['Look at me now!'],
  cheer: ['{from} says: "{message}"'],
  focus: ["Shh, we're studying."],
}

export function line(moment: MochiMoment, vars: Record<string, string> = {}, seed = new Date().getDate()): string {
  const list = LINES[moment]
  const raw = list[seed % list.length]
  return raw.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
}
