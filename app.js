const STORAGE_KEY = 'finance-manager-demo-state';

const { createClient } = window.supabase;
const config = window.SUPABASE_CONFIG || {};
const supabase = createClient(config.url, config.anonKey);

const defaultTransactions = [];

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
    type: rawType === 'income' ? 'income' : 'expense',
    category: row.category_name || row.category || 'Other',
    account: row.account_id || row.account || 'Checking',
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
  els.confirmPasswordWrapper.classList.toggle('hidden', isLogin);
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

    const typeClass = item.type === 'income' ? 'income' : 'expense';
    const iconText = item.type === 'income' ? '↓' : '↑';
    const amountText = item.type === 'income' ? '+' : '-';
    const prettyDate = new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });

    row.innerHTML = `
      <div class="category-icon ${typeClass}">${iconText}</div>
      <div class="transaction-main">
        <strong>${item.title}</strong>
        <span class="transaction-meta">${item.category} • ${prettyDate}</span>
      </div>
      <div class="amount-block">
        <strong class="${typeClass}">${amountText}${formatCurrency(item.amount).replace('$', '$')}</strong>
        <button class="delete-btn" type="button" data-delete="${item.id}" aria-label="Delete transaction">Delete</button>
      </div>
    `;

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
      row.innerHTML = `
        <div class="analytics-row-top">
          <span>${name}</span>
          <strong>${formatCurrency(amount)} (${percent}%)</strong>
        </div>
        <div class="progress-bar"><span style="width: ${percent}%"></span></div>
      `;
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

  if (!state.categories.length) {
    const categoryOption = document.createElement('option');
    categoryOption.value = '';
    categoryOption.textContent = 'No categories available';
    categorySelect.appendChild(categoryOption);
  } else {
    state.categories.forEach((category) => {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name || 'Category';
      categorySelect.appendChild(option);
    });
  }
}

function openModal(type = 'expense') {
  state.transactionType = type;
  populateTransactionSelectors();
  els.modalTitle.textContent = type === 'income' ? 'Add Income' : 'Add Expense';
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
  els.segButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.type === 'expense');
  });
}

function showError(message) {
  alert(message);
}

async function loadAccountsAndCategories() {
  if (!state.user) return;

  const [{ data: accountsData, error: accountsError }, { data: categoriesData, error: categoriesError }] = await Promise.all([
    supabase.from('accounts').select('*').eq('user_id', state.user.id),
    supabase.from('categories').select('*').eq('user_id', state.user.id)
  ]);

  if (accountsError) {
    console.error(accountsError);
  }

  if (categoriesError) {
    console.error(categoriesError);
  }

  state.accounts = accountsData || [];
  state.categories = categoriesData || [];
  populateTransactionSelectors();
}

async function loadTransactions() {
  if (!state.user) {
    state.transactions = loadState('transactions', defaultTransactions);
    saveState();
    renderAll();
    return;
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', state.user.id);

  if (error) {
    console.error(error);
    showError('Could not load transactions from Supabase.');
    return;
  }

  state.transactions = (data || [])
    .map(normalizeTransaction)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  saveState();
  renderAll();
}

async function insertTransaction(transaction) {
  if (!state.user) return;

  const accountValue = transaction.account || '';
  const categoryValue = transaction.category || '';
  const safeAccountId = accountValue && accountValue.length === 36 ? accountValue : null;
  const safeCategoryId = categoryValue && categoryValue.length === 36 ? categoryValue : null;
  const selectedAccount = state.accounts.find((item) => item.id === safeAccountId) || null;
  const selectedCategory = state.categories.find((item) => item.id === safeCategoryId) || null;
  const transactionDate = new Date().toISOString().slice(0, 10);

  const payload = {
    title: transaction.title,
    description: transaction.title,
    amount: Number(transaction.amount),
    type: transaction.type,
    category_name: selectedCategory ? selectedCategory.name : transaction.category || 'Other',
    category_id: safeCategoryId,
    account_id: safeAccountId,
    user_id: state.user.id,
    transaction_date: transactionDate,
    date: Date.now(),
    income: transaction.type === 'income'
  };

  const { error } = await supabase.from('transactions').insert(payload);
  if (error) {
    console.error(error);
    showError('Could not save transaction to Supabase.');
    return false;
  }

  return true;
}

async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) {
    console.error(error);
    showError('Could not delete transaction from Supabase.');
    return false;
  }
  return true;
}

async function initializeSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
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
  const email = els.emailInput.value.trim();
  const password = els.passwordInput.value.trim();

  if (!email || !password) {
    showError('Enter your email and password');
    return;
  }

  if (state.authMode === 'signup') {
    const confirm = els.confirmPasswordInput.value.trim();
    if (password.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      showError('Passwords do not match');
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      showError(error.message || 'Sign up failed.');
      return;
    }

    showError('Success! Please confirm your email.');
    state.authMode = 'login';
    renderAuthView();
    els.authForm.reset();
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    showError(error.message || 'Login failed.');
    return;
  }

  state.user = data?.user || null;
  state.loggedIn = true;
  await loadAccountsAndCategories();
  await loadTransactions();
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
  const { error } = await supabase.auth.signOut();
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
      els.modalTitle.textContent = state.transactionType === 'income' ? 'Add Income' : 'Add Expense';
    });
  });
}

initializeEvents();
renderAuthView();
initializeSession();
