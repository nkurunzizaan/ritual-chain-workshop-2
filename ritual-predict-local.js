const axios = require('axios');
const EventEmitter = require('events');

// Simulated blockchain environment
class LocalBlockchain {
  constructor() {
    this.currentBlock = 0;
    this.blockTimeMs = 195;
  }

  getBlockNumber() {
    return this.currentBlock;
  }

  getBlockTime() {
    return this.blockTimeMs;
  }

  advanceBlocks(blocks) {
    this.currentBlock += blocks;
  }

  advanceTime(ms) {
    const blocksToAdvance = Math.floor(ms / this.blockTimeMs);
    this.currentBlock += blocksToAdvance;
  }
}

// Main Ritual Predict Local implementation
class RitualPredictLocal extends EventEmitter {
  constructor() {
    super();
    this.markets = new Map();
    this.blockchain = new LocalBlockchain();
    this.marketIdCounter = 0;
    this.schedulerInterval = null;
    this.isProcessing = false;
    
    this.httpPrecompile = this.createHttpPrecompile();
    this.jqPrecompile = this.createJqPrecompile();
    this.teesRegistry = this.createTeesRegistry();
    this.scheduler = this.createScheduler();

    this.schedulerInterval = setInterval(() => {
      if (!this.isProcessing) {
        this.isProcessing = true;
        this.processScheduler();
        this.isProcessing = false;
      }
    }, this.blockchain.getBlockTime());
  }

  createHttpPrecompile() {
    return {
      async get(url) {
        try {
          const response = await axios.get(url);
          return { status: response.status, data: response.data };
        } catch (error) {
          console.error('HTTP precompile error:', error.message);
          return { status: 500, data: null };
        }
      }
    };
  }

  createJqPrecompile() {
    return {
      extract(data, jsonPath) {
        try {
          const pathParts = jsonPath.split('.');
          let current = data;
          for (const part of pathParts) {
            if (current && typeof current === 'object' && part in current) {
              current = current[part];
            } else {
              return null;
            }
          }
          if (typeof current === 'number') {
            return current;
          }
          if (typeof current === 'string') {
            const num = parseFloat(current);
            return isNaN(num) ? null : num;
          }
          return null;
        } catch (error) {
          console.error('JQ precompile error:', error);
          return null;
        }
      }
    };
  }

  createTeesRegistry() {
    return {
      pickServiceByCapability(capability, secure, seed, limit) {
        const executors = [
          '0xExecutor1...',
          '0xExecutor2...',
          '0xExecutor3...',
          '0xExecutor4...',
          '0xExecutor5...'
        ];
        const index = (seed + this.getCurrentBlock()) % executors.length;
        return executors[index];
      },

      getCurrentBlock() {
        return Math.floor(Date.now() / 195);
      }
    };
  }

  createScheduler() {
    const scheduledCalls = new Map();
    
    return {
      scheduledCalls,
      
      schedule(marketId, resolveBlock, callback, maxAttempts = 3) {
        scheduledCalls.set(marketId, {
          block: resolveBlock,
          callback,
          attempts: 0,
          maxAttempts
        });
      },

      cancel(marketId) {
        scheduledCalls.delete(marketId);
      },

      processPendingCalls(currentBlock) {
        const toProcess = [];
        for (const [marketId, scheduled] of scheduledCalls.entries()) {
          if (currentBlock >= scheduled.block && scheduled.attempts < scheduled.maxAttempts) {
            toProcess.push([marketId, scheduled]);
          }
        }

        for (const [marketId, scheduled] of toProcess) {
          scheduled.attempts++;
          console.log(`⏰ Processing scheduled call for market ${marketId}, attempt ${scheduled.attempts}`);
          try {
            scheduled.callback(marketId);
            
            if (scheduled.attempts >= scheduled.maxAttempts) {
              scheduledCalls.delete(marketId);
            } else {
              scheduled.block = currentBlock + 200;
            }
          } catch (error) {
            console.error(`Scheduled call failed for market ${marketId}:`, error);
            if (scheduled.attempts >= scheduled.maxAttempts) {
              console.log(`❌ All ${scheduled.maxAttempts} attempts failed for market ${marketId}`);
              scheduledCalls.delete(marketId);
            } else {
              scheduled.block = currentBlock + 200;
            }
          }
        }
      }
    };
  }

  getCurrentBlock() {
    return this.blockchain.getBlockNumber();
  }

  processScheduler() {
    this.blockchain.advanceBlocks(1);
    this.scheduler.processPendingCalls(this.getCurrentBlock());
  }

  createMarket(params) {
    const { target, comparator, oracleUrl, jsonPath, durationSeconds, maxAttempts = 3 } = params;
    
    const resolveBlock = this.getCurrentBlock() + Math.floor(durationSeconds / (this.blockchain.getBlockTime() / 1000));
    const marketId = `MARKET_${++this.marketIdCounter}`;

    const market = {
      id: marketId,
      target,
      comparator,
      oracleUrl,
      jsonPath,
      resolveBlock,
      totalYes: BigInt(0),
      totalNo: BigInt(0),
      stakes: new Map(),
      status: 'OPEN',
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts
    };

    this.markets.set(marketId, market);
    this.scheduler.schedule(marketId, resolveBlock, this.onScheduledResolve.bind(this), maxAttempts);

    console.log(`✅ Market ${marketId} created!`);
    console.log(`   Target: ${target}, Comparator: ${comparator}`);
    console.log(`   Resolves at block: ${resolveBlock} (${durationSeconds}s from now)`);
    console.log(`   Oracle: ${oracleUrl}`);
    console.log(`   JSON path: ${jsonPath}`);

    this.emit('marketCreated', market);
    return market;
  }

  bet(marketId, outcome, amount) {
    const market = this.markets.get(marketId);
    if (!market) {
      throw new Error(`Market ${marketId} not found`);
    }

    if (market.status !== 'OPEN') {
      throw new Error(`Market ${marketId} is not open (status: ${market.status})`);
    }

    if (this.getCurrentBlock() >= market.resolveBlock) {
      throw new Error(`Betting window closed for market ${marketId}`);
    }

    if (outcome === 'YES') {
      market.totalYes += amount;
    } else {
      market.totalNo += amount;
    }

    const userAddress = `user_${Date.now()}_${Math.random()}`;
    if (!market.stakes.has(userAddress)) {
      market.stakes.set(userAddress, { yes: BigInt(0), no: BigInt(0) });
    }
    const stake = market.stakes.get(userAddress);
    if (outcome === 'YES') {
      stake.yes += amount;
    } else {
      stake.no += amount;
    }

    console.log(`💰 ${amount} RITUAL staked on ${outcome} for market ${marketId}`);
    this.emit('betPlaced', { marketId, outcome, amount, userAddress });
    return true;
  }

  async onScheduledResolve(marketId) {
    const market = this.markets.get(marketId);
    if (!market) {
      console.log(`Market ${marketId} not found`);
      return;
    }

    if (market.status !== 'OPEN') {
      console.log(`Market ${marketId} already resolved (status: ${market.status})`);
      return;
    }

    console.log(`🔍 Resolving market ${marketId}...`);

    try {
      const seed = Math.floor(Math.random() * 1000000);
      const executor = this.teesRegistry.pickServiceByCapability('HTTP_CALL', true, seed, 8);
      console.log(`   Selected executor: ${executor}`);

      const response = await this.httpPrecompile.get(market.oracleUrl);
      if (response.status !== 200 || !response.data) {
        throw new Error(`HTTP call failed with status ${response.status}`);
      }
      console.log(`   HTTP call successful`);

      const observedValue = this.jqPrecompile.extract(response.data, market.jsonPath);
      if (observedValue === null) {
        throw new Error(`Failed to extract value at path: ${market.jsonPath}`);
      }
      console.log(`   Extracted value: ${observedValue}`);

      const resolved = this.compareValues(observedValue, market.target, market.comparator);
      market.observedValue = observedValue;

      if (resolved) {
        market.outcome = 'YES';
        market.status = 'RESOLVED';
        console.log(`✅ Market ${marketId} resolved to YES (${observedValue} ${market.comparator} ${market.target})`);
      } else {
        market.outcome = 'NO';
        market.status = 'RESOLVED';
        console.log(`❌ Market ${marketId} resolved to NO (${observedValue} ${market.comparator} ${market.target})`);
      }

      this.scheduler.cancel(marketId);
      this.emit('marketResolved', {
        marketId,
        outcome: market.outcome,
        observedValue: market.observedValue,
        target: market.target,
        comparator: market.comparator
      });

      this.distributeRewards(marketId);

    } catch (error) {
      console.error(`❌ Resolution attempt failed for market ${marketId}:`, error.message);
      
      market.attempts++;
      
      if (market.attempts >= market.maxAttempts) {
        market.status = 'INVALID';
        console.log(`⚠️ Market ${marketId} marked as INVALID after ${market.maxAttempts} failed attempts`);
        this.emit('marketInvalid', { marketId, reason: 'Max attempts exceeded' });
        this.scheduler.cancel(marketId);
      } else {
        console.log(`   Will retry (${market.attempts}/${market.maxAttempts})`);
      }
    }
  }

  compareValues(observed, target, comparator) {
    switch (comparator) {
      case 'gte': return observed >= target;
      case 'lte': return observed <= target;
      case 'eq': return observed === target;
      case 'gt': return observed > target;
      case 'lt': return observed < target;
      default: return false;
    }
  }

  distributeRewards(marketId) {
    const market = this.markets.get(marketId);
    if (!market || market.status !== 'RESOLVED') {
      return;
    }

    const winningOutcome = market.outcome;
    if (!winningOutcome) return;

    const winningPool = winningOutcome === 'YES' ? market.totalYes : market.totalNo;
    const totalPool = market.totalYes + market.totalNo;

    if (winningPool === BigInt(0)) {
      console.log(`⚠️ No one backed the winning side, everyone gets refunds`);
      this.emit('refundsAvailable', { marketId });
      return;
    }

    let totalDistributed = BigInt(0);
    for (const [userAddress, stakes] of market.stakes.entries()) {
      const userStake = winningOutcome === 'YES' ? stakes.yes : stakes.no;
      if (userStake > 0) {
        const proportionalShare = (userStake * totalPool) / winningPool;
        totalDistributed += proportionalShare;
        
        console.log(`   ${userAddress}: ${proportionalShare} RITUAL (staked: ${userStake})`);
        this.emit('rewardDistributed', {
          marketId,
          userAddress,
          amount: proportionalShare,
          stake: userStake
        });
      }
    }

    console.log(`📊 Total rewards distributed: ${totalDistributed} RITUAL`);
  }

  getMarket(marketId) {
    return this.markets.get(marketId);
  }

  getMarkets() {
    return Array.from(this.markets.values());
  }

  getUserStake(marketId, userAddress) {
    const market = this.markets.get(marketId);
    if (!market) return undefined;
    return market.stakes.get(userAddress);
  }

  async advanceTime(seconds, waitForResolution = true) {
    const ms = seconds * 1000;
    const blocksToAdvance = Math.floor(ms / this.blockchain.getBlockTime());
    
    console.log(`⏰ Advancing time by ${seconds} seconds (${blocksToAdvance} blocks)`);
    
    for (let i = 0; i < blocksToAdvance; i++) {
      this.blockchain.advanceBlocks(1);
      this.scheduler.processPendingCalls(this.getCurrentBlock());
      
      if (waitForResolution) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  destroy() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }
}

module.exports = { RitualPredictLocal };
