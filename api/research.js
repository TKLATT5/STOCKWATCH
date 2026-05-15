export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const { ticker } = req.body;
    if (!ticker) return res.status(400).json({ error: 'Ticker required' });

    const prompt = `You are a stock analyst. Provide your best current knowledge about ${ticker} stock. Return ONLY a JSON object, no markdown, no backticks, starting with { and ending with }:
{"ticker":"${ticker}","name":"full company name","sector":"sector","exchange":"NYSE or NASDAQ","description":"what company does in 2 sentences","price":{"current":0.00,"prev_close":0.00,"week52_high":0.00,"week52_low":0.00,"market_cap":"$0B","volume":"0M"},"technicals":{"sma50":0.00,"sma200":0.00,"sma50_signal":"above or below","sma200_signal":"above or below","rsi":0,"rsi_signal":"neutral/overbought/oversold","trend":"uptrend/downtrend/sideways","support":0.00,"resistance":0.00},"valuation":{"pe_trailing":0.0,"pe_forward":0.0,"dividend_yield":"0%","beta":0.00},"earnings":{"latest_quarter":"Q1 2026","gaap_eps":0.00,"non_gaap_eps":0.00,"gap_reason":"reason for gap","revenue":"$0B","revenue_growth":"+0%","gross_margin":"0%","next_earnings_date":"Month DD YYYY"},"analyst":{"consensus":"Buy","num_analysts":0,"target_high":0.00,"target_median":0.00,"target_low":0.00,"implied_upside":"+0%","recent_actions":["Firm raises target to $X","Firm reiterates Buy"]},"news":[{"headline":"recent headline 1","sentiment":"bullish","date":"May 2026","impact":"high"},{"headline":"recent headline 2","sentiment":"neutral","date":"May 2026","impact":"medium"},{"headline":"recent headline 3","sentiment":"bearish","date":"May 2026","impact":"low"}],"investments":["major investment or deal 1","major investment or deal 2"],"risks":["key risk 1","key risk 2","key risk 3"],"catalysts":["upcoming catalyst 1","upcoming catalyst 2","upcoming catalyst 3"],"assessment":{"signal":"BUY/HOLD/WATCH/SELL","conviction":"high/medium/low","suggested_buy_zone":0.00,"suggested_sell_zone":0.00,"summary":"2 sentence honest assessment of the stock"}}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();

    let text = '';
    if (data.content) {
      for (const block of data.content) {
        if (block.type === 'text') text += block.text;
      }
    }

    text = text.trim()
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');

    if (first === -1 || last === -1 || last <= first) {
      return res.status(500).json({ error: 'Could not parse response' });
    }

    try {
      const parsed = JSON.parse(text.substring(first, last + 1));
      return res.status(200).json(parsed);
    } catch(e) {
      return res.status(500).json({ error: 'JSON parse failed: ' + e.message });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
