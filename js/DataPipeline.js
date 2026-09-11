class DataPipeline {
  constructor() {
    this.categoryRules = [
      ['카페', /카페|커피|coffee|starbucks|메가커피|투썸|이디야/i],
      ['마트', /마트|market|편의점|cu|gs25|세븐일레븐|emart|홈플러스/i],
      ['식비', /배달|식당|restaurant|burger|치킨|피자|김밥|떡볶이|우동|포케/i],
      ['쇼핑', /올리브영|쇼핑|shop|store|무신사|다이소/i],
      ['교통', /택시|버스|지하철|교통|카카오t|uber/i]
    ];
  }

  normalizeText(text) {
    return String(text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[\t ]+/g, ' ')
      .replace(/\r\n?/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  receiptToExpense(rawText) {
    const text = this.normalizeText(rawText);
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    const merchant = this.extractMerchant(lines);
    const amount = this.extractAmount(text);
    const date = this.extractDate(text);
    const category = this.inferCategory(`${merchant} ${text}`);
    const items = this.extractItems(lines, amount);
    const features = this.buildFeatures({ amount, category, date, merchant, items });

    return {
      merchant,
      amount,
      category,
      date,
      memo: text.slice(0, 1200),
      source: 'ocr',
      rawText: text,
      items,
      features,
      embeddingText: this.buildEmbeddingText({ merchant, amount, category, date, items, memo: text })
    };
  }

  extractMerchant(lines) {
    const ignored = /(사업자|대표자|주소|전화|tel|합계|총액|결제|카드|승인|부가세|vat|영수증|receipt)/i;
    return lines.find(line => line.length >= 2 && line.length <= 40 && !ignored.test(line) && !/^[-\d\s.,:₩￦원]+$/.test(line)) || '인식된 가맹점';
  }

  extractAmount(text) {
    const explicitTotal = text.match(/(?:합계|총액|결제금액|받을금액)[^\d₩￦]{0,12}(?:₩|￦)?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,9})/i);
    if (explicitTotal) return Number(explicitTotal[1].replace(/,/g, '')) || 0;

    const matches = [...text.matchAll(/(?:₩|￦)?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,8})\s*(?:원)?/g)]
      .map(match => Number(match[1].replace(/,/g, '')))
      .filter(value => value >= 100 && value <= 100000000);
    return matches.length ? Math.max(...matches) : 0;
  }

  extractDate(text) {
    const match = text.match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})(?:일)?(?:\s+(\d{1,2})[:시](\d{2}))?/);
    if (!match) return new Date().toISOString().slice(0, 16);
    const pad = value => String(value).padStart(2, '0');
    return `${match[1]}-${pad(match[2])}-${pad(match[3])}T${pad(match[4] || 12)}:${pad(match[5] || 0)}`;
  }

  inferCategory(text) {
    for (const [category, rule] of this.categoryRules) {
      if (rule.test(text)) return category;
    }
    return '기타';
  }

  extractItems(lines, totalAmount = 0) {
    const ignored = /(합계|총액|결제|카드|승인|부가세|vat|사업자|주소|전화|tel)/i;
    const items = [];

    for (const line of lines) {
      if (ignored.test(line)) continue;
      const match = line.match(/^(.{1,40}?)\s+(?:₩|￦)?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,8})\s*(?:원)?$/);
      if (!match) continue;
      const name = match[1].trim();
      const price = Number(match[2].replace(/,/g, ''));
      if (!name || !Number.isFinite(price) || price <= 0 || price === totalAmount) continue;
      if (/^\d+$/.test(name)) continue;
      items.push({ name, price, quantity: 1 });
    }

    return items.slice(0, 30);
  }

  buildFeatures(record) {
    const parsed = new Date(record.date);
    const hour = Number.isNaN(parsed.getTime()) ? 12 : parsed.getHours();
    return {
      hour,
      timeBand: this.timeBand(hour),
      isFoodRelated: ['식비', '카페', '마트'].includes(record.category),
      transactionCount: 1,
      itemCount: Array.isArray(record.items) ? record.items.length : 0,
      amountLog: record.amount > 0 ? Number(Math.log1p(record.amount).toFixed(4)) : 0
    };
  }

  timeBand(hour) {
    if (hour <= 5) return '심야';
    if (hour <= 10) return '아침';
    if (hour <= 13) return '점심';
    if (hour <= 17) return '오후';
    if (hour <= 21) return '저녁';
    return '밤';
  }

  buildEmbeddingText(record) {
    const parsed = new Date(record.date);
    const hour = Number.isNaN(parsed.getTime()) ? 12 : parsed.getHours();
    const itemNames = (record.items || []).map(item => item.name).filter(Boolean).slice(0, 12);
    const memo = String(record.memo || '').replace(/\s+/g, ' ').slice(0, 300);
    return [
      `상호 ${record.merchant || '미상'}`,
      `카테고리 ${record.category || '기타'}`,
      `금액 ${Number(record.amount || 0)}원`,
      `시간대 ${this.timeBand(hour)}`,
      itemNames.length ? `품목 ${itemNames.join(', ')}` : '',
      memo ? `메모 ${memo}` : ''
    ].filter(Boolean).join(' | ');
  }

  toEmbeddingRecord(expense) {
    return {
      id: expense.id || null,
      entityType: 'expense',
      embeddingText: expense.embeddingText || this.buildEmbeddingText(expense),
      metadata: {
        merchant: expense.merchant || '',
        category: expense.category || '기타',
        amount: Number(expense.amount || 0),
        timeBand: expense.features?.timeBand || this.timeBand(new Date(expense.date).getHours())
      },
      vector: null,
      vectorStatus: 'not_generated'
    };
  }
}

window.SPOTDataPipeline = new DataPipeline();
