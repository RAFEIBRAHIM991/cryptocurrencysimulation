const tabs = document.querySelectorAll(".tab-link");
const panes = document.querySelectorAll(".tab-pane");

function clearTabs() {
  tabs.forEach(t => t.classList.remove("active"));
  panes.forEach(p => p.classList.remove("active"));
}

function showTab(tabId) {
  clearTabs();
  document.querySelector(`[data-tab='${tabId}']`).classList.add("active");
  document.getElementById(tabId).classList.add("active");
  
  // Load data for specific tabs
  switch(tabId) {
    case "dashboard":
      loadDashboard();
      break;
    case "analytics":
      loadAnalytics();
      break;
    case "parameters":
      loadParameters();
      break;
    case "mempool":
      fetchMempool();
      break;
    case "decentralization":
      loadDecentralization();
      break;
    case "explorer":
      fetchBlockchain();
      break;
    case "history":
      fetchTransactions();
      break;
  }
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    showTab(tab.dataset.tab);
  });
});

// -----------------------------
// Dashboard Functions
// -----------------------------
async function loadDashboard() {
  try {
    const [analyticsRes, balancesRes] = await Promise.all([
      fetch("/analytics"),
      fetch("/balances")
    ]);
    
    const analytics = await analyticsRes.json();
    const balances = await balancesRes.json();
    
    updateNetworkStatus(analytics);
    updateQuickStats(analytics, balances);
    updateRecentActivity(analytics);
    updateNetworkHealth(analytics);
  } catch (e) {
    console.error("Error loading dashboard:", e);
  }
}

function updateNetworkStatus(analytics) {
  const status = document.getElementById("networkStatus");
  const params = analytics.network_params;
  
  const statusHtml = `
    <div class="metric-value">${analytics.total_blocks}</div>
    <div class="metric-label">Total Blocks</div>
    <p><span class="status-indicator status-healthy"></span>Network Active</p>
    <p><strong>Difficulty:</strong> ${params.mining_difficulty}</p>
    <p><strong>Block Size:</strong> ${formatBytes(params.block_size_limit)}</p>
    <p><strong>Target Block Time:</strong> ${params.block_time_target}s</p>
  `;
  
  status.innerHTML = statusHtml;
}

function updateQuickStats(analytics, balances) {
  const stats = document.getElementById("quickStats");
  const totalBalance = Object.values(balances).reduce((sum, bal) => sum + bal, 0);
  
  const statsHtml = `
    <div class="metric-value">${analytics.total_transactions}</div>
    <div class="metric-label">Total Transactions</div>
    <p><strong>Mempool:</strong> ${analytics.mempool_size} pending</p>
    <p><strong>Total Supply:</strong> ${totalBalance.toFixed(2)} SIM</p>
    <p><strong>Avg Block Size:</strong> ${formatBytes(analytics.average_block_size)}</p>
    <p><strong>Blocks Mined:</strong> ${analytics.mining_stats.total_blocks_mined}</p>
  `;
  
  stats.innerHTML = statsHtml;
}

function updateRecentActivity(analytics) {
  const activity = document.getElementById("recentActivity");
  const recentBlocks = analytics.mining_stats.total_blocks_mined;
  const recentTxns = analytics.total_transactions;
  
  const activityHtml = `
    <div class="metric-value">${recentTxns}</div>
    <div class="metric-label">Total Transactions</div>
    <p><strong>Recent Blocks:</strong> ${recentBlocks}</p>
    <p><strong>Difficulty Adjustments:</strong> ${analytics.mining_stats.difficulty_adjustments}</p>
    <p><strong>Orphaned Blocks:</strong> ${analytics.mining_stats.orphaned_blocks}</p>
  `;
  
  activity.innerHTML = activityHtml;
}

function updateNetworkHealth(analytics) {
  const health = document.getElementById("networkHealth");
  const decentralization = analytics.decentralization_metrics;
  
  // Calculate health score based on decentralization metrics
  const giniScore = Math.max(0, 1 - decentralization.gini_coefficient);
  const concentrationScore = Math.max(0, 1 - (decentralization.top_miners_concentration / 100));
  const healthScore = ((giniScore + concentrationScore) / 2 * 100).toFixed(1);
  
  let healthStatus = "Healthy";
  let statusClass = "status-healthy";
  
  if (healthScore < 50) {
    healthStatus = "Critical";
    statusClass = "status-critical";
  } else if (healthScore < 75) {
    healthStatus = "Warning";
    statusClass = "status-warning";
  }
  
  const healthHtml = `
    <div class="metric-value">${healthScore}%</div>
    <div class="metric-label">Network Health Score</div>
    <p><span class="status-indicator ${statusClass}"></span>${healthStatus}</p>
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${healthScore}%"></div>
    </div>
    <p><strong>Gini Coefficient:</strong> ${(decentralization.gini_coefficient * 100).toFixed(1)}%</p>
    <p><strong>Top 3 Concentration:</strong> ${decentralization.top_miners_concentration.toFixed(1)}%</p>
  `;
  
  health.innerHTML = healthHtml;
}

// -----------------------------
// Analytics Functions
// -----------------------------
async function loadAnalytics() {
  try {
    const res = await fetch("/analytics");
    const analytics = await res.json();
    
    updateNetworkParams(analytics);
    updateMiningStats(analytics);
    updateTransactionMetrics(analytics);
    updateBlockStats(analytics);
  } catch (e) {
    console.error("Error loading analytics:", e);
  }
}

function updateNetworkParams(analytics) {
  const params = document.getElementById("networkParams");
  const networkParams = analytics.network_params;
  
  const paramsHtml = `
    <p><strong>Block Size Limit:</strong> ${formatBytes(networkParams.block_size_limit)}</p>
    <p><strong>Mining Difficulty:</strong> ${networkParams.mining_difficulty}</p>
    <p><strong>Transaction Fee:</strong> ${networkParams.transaction_fee} SIM</p>
    <p><strong>Block Time Target:</strong> ${networkParams.block_time_target}s</p>
    <p><strong>Max Tx per Block:</strong> ${networkParams.max_transactions_per_block}</p>
  `;
  
  params.innerHTML = paramsHtml;
}

function updateMiningStats(analytics) {
  const stats = document.getElementById("miningStats");
  const miningStats = analytics.mining_stats;
  
  const statsHtml = `
    <p><strong>Total Blocks Mined:</strong> ${miningStats.total_blocks_mined}</p>
    <p><strong>Total Transactions:</strong> ${miningStats.total_transactions_processed}</p>
    <p><strong>Difficulty Adjustments:</strong> ${miningStats.difficulty_adjustments}</p>
    <p><strong>Orphaned Blocks:</strong> ${miningStats.orphaned_blocks}</p>
    <p><strong>Average Block Time:</strong> ${miningStats.average_block_time.toFixed(2)}s</p>
  `;
  
  stats.innerHTML = statsHtml;
}

function updateTransactionMetrics(analytics) {
  const metrics = document.getElementById("transactionMetrics");
  
  const metricsHtml = `
    <p><strong>Total Transactions:</strong> ${analytics.total_transactions}</p>
    <p><strong>Mempool Size:</strong> ${analytics.mempool_size}</p>
    <p><strong>Average Block Size:</strong> ${formatBytes(analytics.average_block_size)}</p>
    <p><strong>Transaction Throughput:</strong> ${(analytics.total_transactions / Math.max(1, analytics.total_blocks)).toFixed(2)} tx/block</p>
  `;
  
  metrics.innerHTML = metricsHtml;
}

function updateBlockStats(analytics) {
  const stats = document.getElementById("blockStats");
  
  const statsHtml = `
    <p><strong>Total Blocks:</strong> ${analytics.total_blocks}</p>
    <p><strong>Average Block Size:</strong> ${formatBytes(analytics.average_block_size)}</p>
    <p><strong>Block Utilization:</strong> ${((analytics.average_block_size / analytics.network_params.block_size_limit) * 100).toFixed(1)}%</p>
    <p><strong>Chain Length:</strong> ${analytics.total_blocks} blocks</p>
  `;
  
  stats.innerHTML = statsHtml;
}

// -----------------------------
// Parameters Functions
// -----------------------------
async function loadParameters() {
  try {
    const res = await fetch("/analytics");
    const analytics = await res.json();
    const params = analytics.network_params;
    
    // Populate form fields with current values
    document.getElementById("blockSizeLimit").value = params.block_size_limit;
    document.getElementById("miningDifficulty").value = params.mining_difficulty;
    document.getElementById("transactionFee").value = params.transaction_fee;
    document.getElementById("blockTimeTarget").value = params.block_time_target;
    document.getElementById("maxTxPerBlock").value = params.max_transactions_per_block;
  } catch (e) {
    console.error("Error loading parameters:", e);
  }
}

// Parameter form submission
document.getElementById("parameterForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const params = {};
  
  for (let [key, value] of formData.entries()) {
    if (value) {
      params[key] = value;
    }
  }
  
  try {
    const res = await fetch("/update_params", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(params)
    });
    
    if (res.ok) {
      alert("Network parameters updated successfully!");
      loadParameters(); // Reload to show updated values
    } else {
      alert("Failed to update parameters");
    }
  } catch (e) {
    console.error("Error updating parameters:", e);
    alert("Error updating parameters");
  }
});

// -----------------------------
// Mempool Functions
// -----------------------------
async function fetchMempool() {
  try {
    const res = await fetch("/mempool");
    const mempool = await res.json();
    
    const mempoolList = document.getElementById("mempoolList");
    
    if (mempool.length === 0) {
      mempoolList.innerHTML = "<p>No pending transactions in mempool.</p>";
      return;
    }
    
    const mempoolHtml = mempool.map(tx => `
      <div class="transaction-item">
        <p><strong>TXID:</strong> ${tx.txid.substring(0, 16)}...</p>
        <p><strong>From:</strong> ${tx.sender} <strong>To:</strong> ${tx.recipient}</p>
        <p><strong>Amount:</strong> ${tx.amount} SIM <strong>Fee:</strong> ${tx.fee} SIM</p>
        <p><strong>Size:</strong> ${formatBytes(tx.size)}</p>
      </div>
    `).join("");
    
    mempoolList.innerHTML = mempoolHtml;
  } catch (e) {
    document.getElementById("mempoolList").innerText = "Failed to load mempool.";
  }
}

function refreshMempool() {
  fetchMempool();
}

// -----------------------------
// Decentralization Functions
// -----------------------------
async function loadDecentralization() {
  try {
    const res = await fetch("/analytics");
    const analytics = await res.json();
    
    updateDecentralizationMetrics(analytics);
    updateMinerDistribution(analytics);
    updateNetworkConcentration(analytics);
    updateDecentralizationScore(analytics);
  } catch (e) {
    console.error("Error loading decentralization data:", e);
  }
}

function updateDecentralizationMetrics(analytics) {
  const metrics = document.getElementById("decentralizationMetrics");
  const decentralization = analytics.decentralization_metrics;
  
  const metricsHtml = `
    <p><strong>Gini Coefficient:</strong> ${(decentralization.gini_coefficient * 100).toFixed(2)}%</p>
    <p><strong>Herfindahl Index:</strong> ${decentralization.herfindahl_index.toFixed(4)}</p>
    <p><strong>Top Miners Concentration:</strong> ${decentralization.top_miners_concentration.toFixed(1)}%</p>
    <p><strong>Interpretation:</strong> ${getDecentralizationInterpretation(decentralization)}</p>
  `;
  
  metrics.innerHTML = metricsHtml;
}

function updateMinerDistribution(analytics) {
  const distribution = document.getElementById("minerDistribution");
  const miners = analytics.miner_distribution;
  
  if (Object.keys(miners).length === 0) {
    distribution.innerHTML = "<p>No mining activity yet.</p>";
    return;
  }
  
  const minerHtml = Object.entries(miners).map(([miner, stats]) => `
    <p><strong>${miner}:</strong></p>
    <ul>
      <li>Blocks Mined: ${stats.blocks_mined}</li>
      <li>Total Rewards: ${stats.total_rewards.toFixed(2)} SIM</li>
      <li>Hashrate: ${stats.hashrate} H/s</li>
    </ul>
  `).join("");
  
  distribution.innerHTML = minerHtml;
}

function updateNetworkConcentration(analytics) {
  const concentration = document.getElementById("networkConcentration");
  const decentralization = analytics.decentralization_metrics;
  
  const concentrationHtml = `
    <p><strong>Top 3 Miners Control:</strong> ${decentralization.top_miners_concentration.toFixed(1)}%</p>
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${decentralization.top_miners_concentration}%"></div>
    </div>
    <p><strong>Market Concentration:</strong> ${getConcentrationLevel(decentralization.top_miners_concentration)}</p>
    <p><strong>Decentralization Risk:</strong> ${getDecentralizationRisk(decentralization)}</p>
  `;
  
  concentration.innerHTML = concentrationHtml;
}

function updateDecentralizationScore(analytics) {
  const score = document.getElementById("decentralizationScore");
  const decentralization = analytics.decentralization_metrics;
  
  // Calculate overall decentralization score
  const giniScore = Math.max(0, 1 - decentralization.gini_coefficient);
  const concentrationScore = Math.max(0, 1 - (decentralization.top_miners_concentration / 100));
  const overallScore = ((giniScore + concentrationScore) / 2 * 100).toFixed(1);
  
  let scoreClass = "status-healthy";
  if (overallScore < 50) scoreClass = "status-critical";
  else if (overallScore < 75) scoreClass = "status-warning";
  
  const scoreHtml = `
    <div class="metric-value">${overallScore}%</div>
    <div class="metric-label">Decentralization Score</div>
    <p><span class="status-indicator ${scoreClass}"></span>${getScoreLevel(overallScore)}</p>
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${overallScore}%"></div>
    </div>
    <p><strong>Gini Score:</strong> ${(giniScore * 100).toFixed(1)}%</p>
    <p><strong>Concentration Score:</strong> ${(concentrationScore * 100).toFixed(1)}%</p>
  `;
  
  score.innerHTML = scoreHtml;
}

// -----------------------------
// Utility Functions
// -----------------------------
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getDecentralizationInterpretation(decentralization) {
  const gini = decentralization.gini_coefficient;
  if (gini < 0.3) return "Highly decentralized";
  if (gini < 0.5) return "Moderately decentralized";
  if (gini < 0.7) return "Somewhat centralized";
  return "Highly centralized";
}

function getConcentrationLevel(concentration) {
  if (concentration < 30) return "Low";
  if (concentration < 60) return "Medium";
  if (concentration < 80) return "High";
  return "Very High";
}

function getDecentralizationRisk(decentralization) {
  const gini = decentralization.gini_coefficient;
  const concentration = decentralization.top_miners_concentration;
  
  if (gini > 0.7 || concentration > 80) return "High";
  if (gini > 0.5 || concentration > 60) return "Medium";
  return "Low";
}

function getScoreLevel(score) {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  if (score >= 20) return "Poor";
  return "Critical";
}

// -----------------------------
// Enhanced Fetch Functions
// -----------------------------
async function fetchBalances() {
  try {
    const res = await fetch("/balances");
    const data = await res.json();
    const output = Object.entries(data)
      .map(([user, bal]) => `<p><strong>${user}</strong>: ${bal.toFixed(2)} SIM</p>`)
      .join("");
    document.getElementById("balanceList").innerHTML = output || "No balances yet.";
  } catch (e) {
    document.getElementById("balanceList").innerText = "Failed to load balances.";
  }
}

async function fetchBlockchain() {
  try {
    const res = await fetch("/chain");
    const data = await res.json();
    const output = data
      .map(block => `
        <div class="block-item">
          <h4>Block #${block.index}</h4>
          <p><strong>Hash:</strong> ${block.hash.substring(0, 32)}...</p>
          <p><strong>Previous:</strong> ${block.previous_hash.substring(0, 32)}...</p>
          <p><strong>Nonce:</strong> ${block.nonce}</p>
          <p><strong>Transactions:</strong> ${block.transactions.length}</p>
          <p><strong>Size:</strong> ${formatBytes(block.block_size || 0)}</p>
          <p><strong>Timestamp:</strong> ${new Date(block.timestamp * 1000).toLocaleString()}</p>
        </div>
      `).join("");
    document.getElementById("blockchainView").innerHTML = output || "Blockchain is empty.";
  } catch (e) {
    document.getElementById("blockchainView").innerText = "Failed to load blockchain.";
  }
}

async function fetchTransactions() {
  try {
    const res = await fetch("/transactions");
    const data = await res.json();
    const output = data
      .map(tx => `
        <div class="transaction-item">
          <p><strong>TXID:</strong> ${tx.txid ? tx.txid.substring(0, 16) + '...' : 'N/A'}</p>
          <p><strong>${tx.sender}</strong> → <strong>${tx.recipient}</strong>: ${tx.amount} SIM</p>
          <p><strong>Fee:</strong> ${tx.fee || 0} SIM <strong>Block:</strong> #${tx.block}</p>
          <p><strong>Time:</strong> ${new Date(tx.timestamp * 1000).toLocaleString()}</p>
        </div>
      `).join("");
    document.getElementById("transactionList").innerHTML = output || "No transactions yet.";
  } catch (e) {
    document.getElementById("transactionList").innerText = "Failed to load transactions.";
  }
}

function refreshBlockchain() {
  fetchBlockchain();
}

function refreshTransactions() {
  fetchTransactions();
}

// -----------------------------
// Authentication Functions
// -----------------------------
function showFlashMessage(message, type = 'info') {
  const flashContainer = document.querySelector('.flash-messages');
  if (!flashContainer) return;
  
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
    ${message}
  `;
  
  flashContainer.appendChild(alert);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    alert.style.opacity = '0';
    setTimeout(() => alert.remove(), 300);
  }, 5000);
}

function clearFlashMessages() {
  const flashContainer = document.querySelector('.flash-messages');
  if (flashContainer) {
    flashContainer.innerHTML = '';
  }
}

// Handle form validation
function validateTransactionForm() {
  const amount = document.getElementById('amount');
  const recipient = document.getElementById('recipient');
  const userBalance = parseFloat(document.querySelector('.user-balance').textContent.match(/[\d.]+/)[0]);
  const amountValue = parseFloat(amount.value);
  
  if (amountValue > userBalance) {
    showFlashMessage('Insufficient balance for this transaction', 'error');
    return false;
  }
  
  if (amountValue <= 0) {
    showFlashMessage('Amount must be greater than 0', 'error');
    return false;
  }
  
  if (!recipient.value.trim()) {
    showFlashMessage('Please enter a recipient', 'error');
    return false;
  }
  
  return true;
}

// -----------------------------
// Auto Load and Refresh
// -----------------------------
window.addEventListener("DOMContentLoaded", () => {
  // Load dashboard by default
  loadDashboard();
  
  // Set up auto-refresh for dashboard
  setInterval(() => {
    if (document.querySelector('[data-tab="dashboard"]').classList.contains('active')) {
      loadDashboard();
    }
  }, 10000); // Refresh every 10 seconds
  
  // Add form validation to send form
  const sendForm = document.querySelector('.transaction-form');
  if (sendForm) {
    sendForm.addEventListener('submit', (e) => {
      if (!validateTransactionForm()) {
        e.preventDefault();
      }
    });
  }
  
  // Auto-hide flash messages after 5 seconds
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(alert => {
    setTimeout(() => {
      alert.style.opacity = '0';
      setTimeout(() => alert.remove(), 300);
    }, 5000);
  });
});
