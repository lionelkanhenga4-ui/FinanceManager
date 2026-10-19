const STORAGE_KEY = 'finance-manager-demo-state';

const { createClient } = window.supabase;
const config = window.SUPABASE_CONFIG || {};
const supabaseClient = createClient(config.url, config.anonKey);

const defaultTransactions = [];
const defaultCategories = [
  'Food', 'Housing', 'Transport', 'Shopping', 'Utilities', 'Health',
  'Entertainment', 'Salary', 'Freelance', 'Other'
];
const SYNC_INTERVAL_MS = 15_000;

const state = {
  authMode: 'login',
  loggedIn: false,
  currentTab: 'home',
  filter: 'all',
  transactionType: 'expense',
  transactions: [],
  accounts: [],
  categories: [],
  user: null,
  isSyncing: false
};

const els = {
  authScreen: document.getElementById('auth-screen'),
  dashboardScreen: document.getElementById('dashboard-screen'),
  transactionsPanel: document.getElementById('transactions-panel'),
  analyticsPanel: document.getElementById('analytics-panel'),
  authTitle: document.getElementById('auth-title'),
  authSubtitle: document.getElementById('auth-subtitle'),
  authToggle: document.getElementById('auth-toggle'),
  switchText: document.getElementById('switch-text'),
  authSubmit: document.getElementById('auth-submit'),
  authForm: document.getElementById('auth-form'),
  confirmPasswordWrapper: document.getElementById('confirm-password-wrapper'),
  emailField: document.getElementById('email-field'),
  identityLabel: document.getElementById('identity-label'),
  passwordField: document.getElementById('password-field'),
  emailInput: document.getElementById('email-input'),
  passwordInput: document.getElementById('password-input'),
  confirmPasswordInput: document.getElementById('confirm-password-input'),
  balanceAmount: document.getElementById('balance-amount'),
  incomeTotal: document.getElementById('income-total'),
  expenseTotal: document.getElementById('expense-total'),
  recentList: document.getElementById('recent-list'),
  transactionsList: document.getElementById('transactions-list'),
  analyticsList: document.getElementById('analytics-list'),
  emptyState: document.getElementById('empty-state'),
  transactionEmpty: document.getElementById('transaction-empty'),
  analyticsEmpty: document.getElementById('analytics-empty'),
  fab: document.getElementById('fab-add'),
  transactionModal: document.getElementById('transaction-modal'),
  closeModal: document.getElementById('close-modal'),
  transactionForm: document.getElementById('transaction-form'),
  modalTitle: document.getElementById('modal-title'),
  transactionTitle: document.getElementById('transaction-title'),
  transactionAmount: document.getElementById('transaction-amount'),
  transactionCategory: document.getElementById('transaction-category'),
  transactionAccount: document.getElementById('transaction-account'),
  transactionDestinationWrapper: document.getElementById('transaction-destination-wrapper'),
  transactionDestination: document.getElementById('transaction-destination'),
  navItems: [...document.querySelectorAll('.nav-item')],
  filterChips: [...document.querySelectorAll('.chip')],
  segButtons: [...document.querySelectorAll('.segment')]
};

function loadState(key, fallback) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    return parsed[key] ?? fallback;
  } catch (error) {
    return fallback;
  }
}

function saveState() {
  const payload = {
    loggedIn: state.loggedIn,
    transactions: state.transactions
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}

function normalizeTransaction(row) {
  const rawType = row.type ?? (row.income === true ? 'income' : row.income === false ? 'expense' : 'expense');
  const amountValue = Number(row.amount ?? 0);
  const rawDate = row.transaction_date || row.date || row.created_at || new Date().toISOString();

  return {
    id: row.id,
    title: row.title || row.description || 'Untitled',
    amount: amountValue,
    type: ['income', 'expense', 'transfer', 'opening', 'goal_contribution'].includes(rawType)
      ? rawType
      : 'expense',
    category: row.category_name || row.category || 'Other',
    account: row.account_id || row.account || 'No account',
    date: typeof rawDate === 'number' ? new Date(rawDate).toISOString() : rawDate,
    user_id: row.user_id || null
  };
}

function getTotals() {
  const totalIncome = state.transactions
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const totalExpense = state.transactions
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const balance = totalIncome - totalExpense;
  return { totalIncome, totalExpense, balance };
}

function renderAuthView() {
  const isLogin = state.authMode === 'login';
  els.authTitle.textContent = isLogin ? 'Welcome Back' : 'Create Account';
  els.authSubtitle.textContent = isLogin ? 'Sign in to manage your finances' : 'Start managing your money today';
  els.authSubmit.textContent = isLogin ? 'Login' : 'Sign Up';
  els.switchText.textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
  els.authToggle.textContent = isLogin ? 'Sign up' : 'Login';
  els.identityLabel.textContent = isLogin ? 'Email or phone number' : 'Email';
  els.emailInput.placeholder = isLogin ? 'name@example.com or +260...' : 'name@example.com';
  els.authToggle.classList.remove('hidden');
  els.emailField.classList.remove('hidden');
  els.passwordField.classList.remove('hidden');
  els.confirmPasswordWrapper.classList.toggle('hidden', isLogin);
  els.emailInput.required = true;
  els.passwordInput.required = true;
}

function getAuthIdentity(input) {
  const value = input.trim();
  if (value.includes('@')) return { email: value };

  const phone = value.replace(/[\s()-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new Error('Enter a valid email or phone number in international format, such as +260765730952.');
  }
  return { phone };
}

function renderDashboard() {
  const { totalIncome, totalExpense, balance } = getTotals();
  els.balanceAmount.textContent = formatCurrency(balance);
  els.incomeTotal.textContent = `+$${totalIncome.toFixed(2)}`;
  els.expenseTotal.textContent = `-$${totalExpense.toFixed(2)}`;

  const recent = [...state.transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  renderTransactionCards(recent, els.recentList, true);
  els.emptyState.classList.toggle('hidden', recent.length > 0);
}

function renderTransactionsView() {
  const filtered = [...state.transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .filter((item) => {
      if (state.filter === 'all') return true;
      return item.type === state.filter;
    });

  renderTransactionCards(filtered, els.transactionsList, false);
  els.transactionEmpty.classList.toggle('hidden', filtered.length > 0);

  els.filterChips.forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.filter === state.filter);
  });
}

function renderTransactionCards(items, target, compact) {
  target.innerHTML = '';

  if (!items.length) {
    target.innerHTML = '';
    return;
  }

  items.forEach((item) => {
    const row = document.createElement('article');
    row.className = 'transaction-item';

    const typeClass = item.type === 'income' ? 'income' : item.type === 'expense' ? 'expense' : 'transfer';
    const iconText = item.type === 'income' ? '↓' : item.type === 'transfer' ? '↔' : '↑';
    const amountText = item.type === 'income' || item.type === 'opening' ? '+' : item.type === 'transfer' ? '↔ ' : '-';
    const prettyDate = new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });

    const icon = document.createElement('div');
    icon.className = `category-icon ${typeClass}`;
    icon.textContent = iconText;

    const main = document.createElement('div');
    main.className = 'transaction-main';
    const title = document.createElement('strong');
    title.textContent = item.title;
    const meta = document.createElement('span');
    meta.className = 'transaction-meta';
    meta.textContent = `${item.category} • ${prettyDate}`;
    main.append(title, meta);

    const amountBlock = document.createElement('div');
    amountBlock.className = 'amount-block';
    const amountLabel = document.createElement('strong');
    amountLabel.className = typeClass;
    amountLabel.textContent = `${amountText}${formatCurrency(item.amount)}`;
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-btn';
    deleteButton.type = 'button';
    deleteButton.dataset.delete = item.id;
    deleteButton.setAttribute('aria-label', 'Delete transaction');
    deleteButton.textContent = 'Delete';
    amountBlock.append(amountLabel, deleteButton);

    row.append(icon, main, amountBlock);

    if (compact) {
      row.querySelector('.delete-btn').style.display = 'none';
    }

    target.appendChild(row);
  });

  target.querySelectorAll('.delete-btn').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const id = Number(event.currentTarget.dataset.delete);
      if (!id) return;

      await deleteTransaction(id);
      await loadTransactions();
    });
  });
}

function renderAnalytics() {
  const filtered = state.transactions.filter((item) => item.type === 'expense');
  els.analyticsList.innerHTML = '';

  if (!filtered.length) {
    els.analyticsEmpty.classList.remove('hidden');
    return;
  }

  els.analyticsEmpty.classList.add('hidden');

  const totals = filtered.reduce((map, item) => {
    const category = item.category || 'Other';
    map[category] = (map[category] || 0) + Number(item.amount);
    return map;
  }, {});

  const totalExpense = Object.values(totals).reduce((sum, value) => sum + value, 0);

  Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, amount]) => {
      const percent = Math.round((amount / totalExpense) * 100);
      const row = document.createElement('div');
      row.className = 'analytics-row';
      const top = document.createElement('div');
      top.className = 'analytics-row-top';
      const categoryName = document.createElement('span');
      categoryName.textContent = name;
      const total = document.createElement('strong');
      total.textContent = `${formatCurrency(amount)} (${percent}%)`;
      top.append(categoryName, total);

      const progress = document.createElement('div');
      progress.className = 'progress-bar';
      const progressValue = document.createElement('span');
      progressValue.style.width = `${percent}%`;
      progress.appendChild(progressValue);
      row.append(top, progress);
      els.analyticsList.appendChild(row);
    });
}

function renderAppVisibility() {
  const showDashboard = state.loggedIn;
  els.authScreen.classList.toggle('active', !showDashboard);
  els.dashboardScreen.classList.toggle('active', showDashboard && state.currentTab === 'home');
  els.transactionsPanel.classList.toggle('active', showDashboard && state.currentTab === 'transactions');
  els.analyticsPanel.classList.toggle('active', showDashboard && state.currentTab === 'analytics');

  const dashboardMain = document.querySelector('.dashboard-shell');
  if (dashboardMain) {
    dashboardMain.style.display = showDashboard && state.currentTab === 'home' ? 'block' : 'none';
  }

  els.navItems.forEach((button) => {
    button.classList.toggle('active', showDashboard && button.dataset.tab === state.currentTab);
  });
}

function renderAll() {
  renderAppVisibility();
  renderAuthView();
  renderDashboard();
  renderTransactionsView();
  renderAnalytics();
}

function populateTransactionSelectors() {
  const accountSelect = document.getElementById('transaction-account');
  const categorySelect = document.getElementById('transaction-category');

  accountSelect.innerHTML = '';
  categorySelect.innerHTML = '';

  if (!state.accounts.length) {
    const accountOption = document.createElement('option');
    accountOption.value = '';
    accountOption.textContent = 'No accounts available';
    accountSelect.appendChild(accountOption);
  } else {
    state.accounts.forEach((account) => {
      const option = document.createElement('option');
      option.value = account.id;
      option.textContent = account.name || 'Account';
      accountSelect.appendChild(option);
    });
  }

  els.transactionDestination.innerHTML = '';
  if (state.accounts.length) {
    state.accounts.forEach((account) => {
      const option = document.createElement('option');
      option.value = account.id;
      option.textContent = account.name || 'Account';
      els.transactionDestination.appendChild(option);
    });
  }

  if (!state.categories.length) {
    defaultCategories.forEach((name) => {
      const categoryOption = document.createElement('option');
      categoryOption.value = name;
      categoryOption.textContent = name;
      categorySelect.appendChild(categoryOption);
    });
  }
}

function openModal(type = 'expense') {
  state.transactionType = type;
  populateTransactionSelectors();
  els.modalTitle.textContent = type === 'income' ? 'Add Income' : type === 'transfer' ? 'Transfer Funds' : 'Add Expense';
  els.transactionDestinationWrapper.classList.toggle('hidden', type !== 'transfer');
  els.segButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.type === type);
  });
  els.transactionModal.classList.remove('hidden');
  els.transactionModal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  els.transactionModal.classList.add('hidden');
  els.transactionModal.setAttribute('aria-hidden', 'true');
  els.transactionForm.reset();
  state.transactionType = 'expense';
  els.transactionDestinationWrapper.classList.add('hidden');
  els.segButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.type === 'expense');
  });
}

function showError(message) {
  alert(message);
}

async function loadAccountsAndCategories() {
  if (!state.user) return;

  const { data: accountsData, error: accountsError } = await supabaseClient
    .from('accounts')
    .select('*')
    .eq('user_id', state.user.id);

  if (accountsError) {
    console.error(accountsError);
  }

  state.accounts = accountsData || [];
  state.categories = [];
  populateTransactionSelectors();
}

async function loadTransactions(silent = false) {
  if (!state.user) {
    state.transactions = loadState('transactions', defaultTransactions);
    saveState();
    renderAll();
    return;
  }

  if (state.isSyncing) return;
  state.isSyncing = true;

  try {
    const { data, error } = await supabaseClient
      .from('transactions')
      .select('*')
      .eq('user_id', state.user.id);

    if (error) {
      console.error(error);
      if (!silent) showError('Could not load transactions from Supabase.');
      return;
    }

    state.transactions = (data || [])
      .map(normalizeTransaction)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    saveState();
    renderAll();
  } finally {
    state.isSyncing = false;
  }
}

function refreshVisibleSession() {
  if (state.loggedIn && document.visibilityState === 'visible') {
    void loadTransactions(true);
  }
}

window.setInterval(refreshVisibleSession, SYNC_INTERVAL_MS);
document.addEventListener('visibilitychange', refreshVisibleSession);

async function insertTransaction(transaction) {
  if (!state.user) return;

  const accountValue = transaction.account || '';
  const safeAccountId = accountValue && accountValue.length === 36 ? accountValue : null;

  const payload = {
    title: transaction.title,
    amount: Number(transaction.amount),
    type: transaction.type,
    category_name: transaction.category || 'Other',
    account_id: safeAccountId,
    user_id: state.user.id,
    date: Date.now(),
    income: transaction.type === 'income'
  };

  const { error } = await supabaseClient.from('transactions').insert(payload);
  if (error) {
    console.error(error);
    showError('Could not save transaction to Supabase.');
    return false;
  }

  return true;
}

async function deleteTransaction(id) {
  const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
  if (error) {
    console.error(error);
    showError('Could not delete transaction from Supabase.');
    return false;
  }
  return true;
}

async function initializeSession() {
  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error(error);
  }

  state.user = session?.user || null;
  state.loggedIn = Boolean(session);

  if (state.loggedIn) {
    await loadAccountsAndCategories();
    await loadTransactions();
  } else {
    state.transactions = loadState('transactions', defaultTransactions);
    renderAll();
  }
}

async function handleLogin(event) {
  event.preventDefault();
  let identity;
  try {
    identity = getAuthIdentity(els.emailInput.value);
  } catch (error) {
    showError(error.message);
    return;
  }
  const password = els.passwordInput.value;

  if (!password) {
    showError('Enter your password.');
    return;
  }

  els.authSubmit.disabled = true;
  try {
    if (state.authMode === 'signup') {
      if (!identity.email) throw new Error('Sign-up is available with an email address only.');
      const confirm = els.confirmPasswordInput.value;
      if (password.length < 6) throw new Error('Password must be at least 6 characters.');
      if (password !== confirm) throw new Error('Passwords do not match.');

      const { data, error } = await supabaseClient.auth.signUp({ ...identity, password });
      if (error) throw error;

      if (data?.session) {
        state.user = data.user || data.session.user;
        state.loggedIn = Boolean(state.user);
        els.authForm.reset();
        await loadAccountsAndCategories();
        await loadTransactions();
      } else {
        showError('Account created. Please confirm your email, then log in.');
        state.authMode = 'login';
        renderAuthView();
      }
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ ...identity, password });
    if (error) throw error;

    state.user = data?.user || null;
    if (!state.user) throw new Error('Sign in returned no user session. Please try again.');
    state.loggedIn = true;
    renderAll();
    await loadAccountsAndCategories();
    await loadTransactions();
  } catch (error) {
    console.error('Authentication failed:', error);
    showError(error.message || 'Authentication failed. Check your connection and try again.');
  } finally {
    els.authSubmit.disabled = false;
  }
}

async function handleAddTransaction(event) {
  event.preventDefault();
  const title = els.transactionTitle.value.trim();
  const amount = Number(els.transactionAmount.value);
  const category = els.transactionCategory.value;
  const account = els.transactionAccount.value;

  if (!title || !amount || amount <= 0) {
    showError('Please provide a valid title and amount');
    return;
  }

  if (state.transactionType === 'transfer') {
    const sourceAccountId = els.transactionAccount.value;
    const destinationAccountId = els.transactionDestination.value;
    if (!sourceAccountId || !destinationAccountId || sourceAccountId === destinationAccountId) {
      showError('Choose two different accounts for the transfer.');
      return;
    }

    const { error } = await supabaseClient.rpc('transfer_between_accounts', {
      p_source_account_id: sourceAccountId,
      p_destination_account_id: destinationAccountId,
      p_amount: amount,
      p_title: title
    });
    if (error) {
      console.error(error);
      showError(error.message || 'Could not transfer funds.');
      return;
    }

    closeModal();
    await loadTransactions();
    await loadAccountsAndCategories();
    return;
  }

  const transaction = {
    title,
    amount,
    type: state.transactionType,
    category,
    account,
    date: new Date().toISOString()
  };

  const saved = await insertTransaction(transaction);
  if (!saved) return;

  closeModal();
  await loadTransactions();
}

async function logout() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error(error);
  }

  state.loggedIn = false;
  state.user = null;
  state.transactions = [];
  localStorage.removeItem(STORAGE_KEY);
  renderAll();
}

function toggleAuthMode() {
  state.authMode = state.authMode === 'login' ? 'signup' : 'login';
  renderAuthView();
}

function initializeEvents() {
  els.authToggle.addEventListener('click', toggleAuthMode);
  els.authForm.addEventListener('submit', handleLogin);
  els.fab.addEventListener('click', () => openModal('expense'));
  els.closeModal.addEventListener('click', closeModal);
  els.transactionModal.addEventListener('click', (event) => {
    if (event.target.dataset.close === 'true') closeModal();
  });
  els.transactionForm.addEventListener('submit', handleAddTransaction);
  document.getElementById('see-all-btn').addEventListener('click', () => {
    state.currentTab = 'transactions';
    renderAll();
  });
  document.getElementById('logout-btn').addEventListener('click', logout);

  els.navItems.forEach((button) => {
    button.addEventListener('click', () => {
      state.currentTab = button.dataset.tab;
      renderAll();
    });
  });

  els.filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      state.filter = chip.dataset.filter;
      renderTransactionsView();
    });
  });

  els.segButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.transactionType = button.dataset.type;
      els.segButtons.forEach((seg) => seg.classList.toggle('active', seg === button));
      els.modalTitle.textContent = state.transactionType === 'income'
        ? 'Add Income'
        : state.transactionType === 'transfer' ? 'Transfer Funds' : 'Add Expense';
      els.transactionDestinationWrapper.classList.toggle('hidden', state.transactionType !== 'transfer');
    });
  });
}

initializeEvents();
renderAuthView();
initializeSession();
