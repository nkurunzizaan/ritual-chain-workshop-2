const { RitualPredictLocal } = require('./ritual-predict-local');

async function main() {
  console.log('🚀 Starting Ritual Predict Demo\n');

  const ritualPredict = new RitualPredictLocal();

  // Listen to events
  ritualPredict.on('marketCreated', (market) => {
    console.log(`📋 Market created: ${market.id}\n`);
  });

  ritualPredict.on('betPlaced', ({ marketId, outcome, amount }) => {
    console.log(`💰 Bet placed: ${amount} on ${outcome} for ${marketId}\n`);
  });

  ritualPredict.on('marketResolved', ({ marketId, outcome, observedValue, target }) => {
    console.log(`🎯 Market ${marketId} resolved to ${outcome}!`);
    console.log(`   Observed: ${observedValue}, Target: ${target}\n`);
  });

  ritualPredict.on('marketInvalid', ({ marketId, reason }) => {
    console.log(`⚠️ Market ${marketId} invalid: ${reason}\n`);
  });

  ritualPredict.on('rewardDistributed', ({ marketId, userAddress, amount }) => {
    console.log(`💸 Reward: ${amount} to ${userAddress} for ${marketId}`);
  });

  // Market 1: ETH/USD >= $4,500
  console.log('=== Market 1: ETH/USD >= $4,500 ===');
  const market1 = ritualPredict.createMarket({
    target: 4500,
    comparator: 'gte',
    oracleUrl: 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
    jsonPath: 'ethereum.usd',
    durationSeconds: 5,
    maxAttempts: 3
  });

  console.log('\n=== Placing bets on Market 1 ===');
  ritualPredict.bet(market1.id, 'YES', BigInt(200));
  ritualPredict.bet(market1.id, 'NO', BigInt(100));

  // Market 2: BTC/USD <= $60,000
  console.log('\n=== Market 2: BTC/USD <= $60,000 ===');
  const market2 = ritualPredict.createMarket({
    target: 60000,
    comparator: 'lte',
    oracleUrl: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
    jsonPath: 'bitcoin.usd',
    durationSeconds: 3,
    maxAttempts: 2
  });

  console.log('\n=== Placing bets on Market 2 ===');
  ritualPredict.bet(market2.id, 'YES', BigInt(100));
  ritualPredict.bet(market2.id, 'NO', BigInt(150));

  // Market 3: SOL/USD > $50
  console.log('\n=== Market 3: SOL/USD > $50 ===');
  const market3 = ritualPredict.createMarket({
    target: 50,
    comparator: 'gt',
    oracleUrl: 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
    jsonPath: 'solana.usd',
    durationSeconds: 4,
    maxAttempts: 3
  });

  console.log('\n=== Placing bets on Market 3 ===');
  ritualPredict.bet(market3.id, 'YES', BigInt(75));
  ritualPredict.bet(market3.id, 'NO', BigInt(50));

  // Advance time for all markets
  console.log('\n=== Advancing time to resolve all markets ===');
  await ritualPredict.advanceTime(6);

  console.log('\n=== All Markets ===');
  const allMarkets = ritualPredict.getMarkets();
  allMarkets.forEach(market => {
    console.log(`Market ${market.id}: ${market.status}`);
    console.log(`  Total YES: ${market.totalYes}, Total NO: ${market.totalNo}`);
    console.log(`  Outcome: ${market.outcome || 'Pending'}`);
    console.log(`  Observed: ${market.observedValue || 'N/A'}`);
    console.log('---');
  });

  ritualPredict.destroy();
  console.log('\n✅ Demo complete!');
}

main().catch(console.error);
