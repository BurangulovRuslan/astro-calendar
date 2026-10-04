  const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const THEMES = [
    {id:'self', number:0, name:'Внутренний мир', x:420, y:700},
    {id:'work', number:1, name:'Работа', x:350, y:500},
    {id:'study', number:2, name:'Учёба и документы', x:490, y:270},
    {id:'relationships', number:3, name:'Отношения', x:390, y:165},
    {id:'body', number:4, name:'Тело и самочувствие', x:180, y:410},
    {id:'family', number:5, name:'Дом и семья', x:240, y:300},
    {id:'friends', number:6, name:'Друзья и сообщества', x:270, y:130},
    {id:'money', number:7, name:'Деньги', x:535, y:365},
    {id:'travel', number:8, name:'Поездки', x:405, y:605},
    {id:'all', number:9, name:'Все темы', x:290, y:660}
  ];
  const SEASONS = {
    all:{name:'Весь год', months:[1,2,3,4,5,6,7,8,9,10,11,12]},
    winter:{name:'Зима', months:[1,2]},
    spring:{name:'Весна', months:[3,4,5]},
    summer:{name:'Лето', months:[6,7,8]},
    autumn:{name:'Осень', months:[9,10,11]},
    prologue:{name:'Ноябрь — декабрь 2025', months:[11,12]}
  };
  const KIND = {challenge:'Трудность', strength:'Сильная сторона', mixed:'Смешанная тема'};
  function eventYear(event, month) {
    return event.monthYears?.[month] || (event.source.id === 's3' && month >= 11 ? 2025 : 2026);
  }
  function matchesPeriod(event, state) {
    if (state.year !== 2026) return false;
    if (state.view === 'general') return event.precision === 'general';
    if (event.precision === 'general') return false;
    const months = state.month ? [state.month] : SEASONS[state.season].months;
    const year = state.season === 'prologue' ? 2025 : 2026;
    return event.months.some(m => months.includes(m) && eventYear(event,m) === year);
  }
  function filterEvents(events, state, ignoreTheme = false) {
    const query = (state.search || '').trim().toLocaleLowerCase('ru');
    return events.filter(e => matchesPeriod(e,state)
      && (ignoreTheme || !state.theme || state.theme === 'all' || e.theme === state.theme)
      && (!state.kind || e.kind === state.kind)
      && (!query || [e.title,e.summary,e.timingLabel, THEMES.find(t=>t.id===e.theme)?.name].join(' ').toLocaleLowerCase('ru').includes(query)));
  }
  function validateNotes(value) {
    if (!value || value.format !== 'astro-archive-notes' || value.version !== 1 || !value.notes || typeof value.notes !== 'object' || Array.isArray(value.notes)) return false;
    return Object.entries(value.notes).length <= 300 && Object.entries(value.notes).every(([key,text]) => /^20\d{2}:(all|winter|spring|summer|autumn|prologue):([0-9]|1[0-2])$/.test(key) && typeof text === 'string' && text.length <= 12000);
  }
module.exports = {MONTHS,THEMES,SEASONS,KIND,eventYear,matchesPeriod,filterEvents,validateNotes};
