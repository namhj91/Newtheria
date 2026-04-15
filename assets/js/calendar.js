(() => {
  const MONTH_DATA = {
    1: { n: '로고스', d: '진리와 언령의 룬' },
    2: { n: '엔트로', d: '혼돈과 소멸의 룬' },
    3: { n: '피오라', d: '생명과 치유의 룬' },
    4: { n: '실루아', d: '정령과 환영의 룬' },
    5: { n: '아스트라', d: '별과 예지의 룬' },
    6: { n: '이그니스', d: '기원염과 파괴의 룬' },
    7: { n: '볼바르', d: '뇌우와 기상의 룬' },
    8: { n: '테라크', d: '용혈과 변이의 룬' },
    9: { n: '가란', d: '대지와 진동의 룬' },
    10: { n: '오리할', d: '연금과 결속의 룬' },
    11: { n: '모리아', d: '수호와 봉인의 룬' },
    12: { n: '아르카', d: '순수 마나와 비전의 룬' }
  };

  const WEEK_DATA = {
    1: { n: '태동(胎動)', d: '마력이 막 깨어나는 주' },
    2: { n: '충만(充滿)', d: '마력이 가득 차오르는 주' },
    3: { n: '쇠퇴(衰退)', d: '마력이 서서히 기우는 주' },
    4: { n: '심연(深淵)', d: '마력이 가라앉아 휴식하는 주' }
  };

  const getSeason = (month) => {
    if (month >= 3 && month <= 5) {
      return {
        name: '엘다나스의 절기(봄)',
        desc: '테마: 정령 / 생명, 개화, 신록'
      };
    }
    if (month >= 6 && month <= 8) {
      return {
        name: '드라칸의 절기(여름)',
        desc: '테마: 드래곤 / 열기, 투쟁, 생명력'
      };
    }
    if (month >= 9 && month <= 11) {
      return {
        name: '두르간의 절기(가을)',
        desc: '테마: 거인 / 수확, 대지, 제련'
      };
    }
    return {
      name: '아르케의 절기(겨울)',
      desc: '테마: 천사 / 심판, 지혜, 침묵'
    };
  };

  const normalizeDate = (dateObj = {}) => {
    const year = Number.isInteger(dateObj.year) ? Math.max(1, dateObj.year) : 1;
    const month = Number.isInteger(dateObj.month) ? Math.min(12, Math.max(1, dateObj.month)) : 1;
    const week = Number.isInteger(dateObj.week) ? Math.min(4, Math.max(1, dateObj.week)) : 1;
    return { year, month, week };
  };

  const getCalendarInfo = (dateObj) => {
    const normalized = normalizeDate(dateObj);
    const season = getSeason(normalized.month);
    const monthInfo = MONTH_DATA[normalized.month];
    const weekInfo = WEEK_DATA[normalized.week];
    return {
      seasonName: season.name,
      seasonDesc: season.desc,
      monthName: monthInfo.n,
      monthDesc: monthInfo.d,
      weekName: weekInfo.n,
      weekDesc: weekInfo.d
    };
  };

  const TURN_MODE = {
    WEEKLY: 'weekly',
    HISTORY_YEARLY: 'history_yearly'
  };

  const advanceTurn = (dateObj, mode = TURN_MODE.WEEKLY) => {
    const normalized = normalizeDate(dateObj);

    if (mode === TURN_MODE.HISTORY_YEARLY) {
      return {
        year: normalized.year + 1,
        month: 1,
        week: 1
      };
    }

    let year = normalized.year;
    let month = normalized.month;
    let week = normalized.week + 1;
    if (week > 4) {
      week = 1;
      month += 1;
    }
    if (month > 12) {
      month = 1;
      year += 1;
    }
    return { year, month, week };
  };

  const getTurnRuleLabel = (mode = TURN_MODE.WEEKLY) => {
    if (mode === TURN_MODE.HISTORY_YEARLY) return '역사 모드(1턴=1년)';
    return '일반 월드맵(1턴=1주)';
  };

  window.NewtheriaCalendar = {
    TURN_MODE,
    createDefaultDate() {
      return { year: 1, month: 1, week: 1 };
    },
    normalizeDate,
    getCalendarInfo,
    advanceTurn,
    getTurnRuleLabel
  };
})();
