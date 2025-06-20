// frontend.js
console.log('测试：JavaScript 文件已加载'); // 添加这行

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM 加载完成，开始初始化...');

  // --------------------- DOM 元素获取 ---------------------
  const characterListEl = document.getElementById('character-list');
  const addCharacterBtn = document.getElementById('add-character-btn');
  const characterModalEl = document.getElementById('character-modal');
  const closeCharModalBtn = document.getElementById('close-char-modal');
  const characterForm = document.getElementById('character-form');
  const searchInput = document.getElementById('search-input');
  const incomeSubcategory = document.getElementById('income-subcategory');
  const incomeForm = document.getElementById('income-form');
  const charSelect = document.getElementById('char-select');
  const incomeAmount = document.getElementById('income-amount');
  const incomeCategory = document.getElementById('income-category');
  const statsTable = document.getElementById('stats-table');
  const statsTime = document.getElementById('stats-time');
  const totalWeekIncomeEl = document.getElementById('total-week-income');
  const totalDepositEl = document.getElementById('total-deposit');
  const recordsTable = document.getElementById('records-table');
  const recordFilterCharacter = document.getElementById('record-filter-character');
  const recordFilterType = document.getElementById('record-filter-type');
  const recordFilterTime = document.getElementById('record-filter-time');
  const customStartDate = document.getElementById('custom-start-date');
  const customEndDate = document.getElementById('custom-end-date');
  const recordsTotalAmount = document.getElementById('records-total-amount');
  const navBtns = document.querySelectorAll('.nav-btn');
  const rightContent = document.getElementById('right-content');
  const panels = {
    income: document.getElementById('income-panel'),
    stats: document.getElementById('stats-panel')
  };
  const accountModalEl = document.getElementById('account-modal');
  const closeAccountModalBtn = document.getElementById('close-account-modal');
  const accountForm = document.getElementById('account-form');
  const addAccountBtn = document.getElementById('add-account-btn');

  // --------------------- 数据存储核心逻辑 ---------------------
  const STORAGE_KEY = 'jx3IncomeTool';
  let data = {
    accounts: [],
    characters: [],
    incomeRecords: []
  };

  const incomeTypes = {
    "PVE": ["10人周常", "10人", "25pt", "25yx"],
    "日常": ["大战", "茶馆", "跑商"]
  };

  function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
        data = JSON.parse(stored);
        
        // Migration: ensure `accounts` field exists for older data structures.
        if (!data.accounts) {
            data.accounts = [];
        }

        // Cleanup: Remove accounts that have no characters associated with them.
        const activeAccounts = new Set(data.characters.map(char => char.account));
        const originalAccountCount = data.accounts.length;
        data.accounts = data.accounts.filter(acc => activeAccounts.has(acc));

        if (data.accounts.length < originalAccountCount) {
            console.log('已清理无关联角色的账号。');
        }
        
        // Data migration for older character data.
        data.characters.forEach(char => {
            if (!char.hasOwnProperty('initialDeposit')) {
                char.initialDeposit = char.deposit;
                char.totalIncome = char.deposit;
            }
        });
        
        cleanUpOrphanedRecords();
    }
    // If no data is stored, the application will start with empty arrays
    // for accounts, characters, and records, as defined globally.
  }

  function cleanUpOrphanedRecords() {
    const existingCharacters = data.characters.map(char => char.name);
    const validRecords = data.incomeRecords.filter(record =>
      existingCharacters.includes(record.character)
    );
    if (validRecords.length !== data.incomeRecords.length) {
      data.incomeRecords = validRecords;
      saveData();
      console.log('已清理孤立的收入记录');
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function addNewCharacter(name, deposit, unit, account) {
    if (data.characters.some(char => char.name === name)) {
      showToast('该角色已存在！', false);
      return;
    }
    let depositInGold = unit === 'brick' ? deposit * 10000 : deposit;
    const newCharacter = {
      name: name,
      initialDeposit: deposit,
      initialDepositUnit: unit,
      totalIncome: depositInGold,
      income: [],
      weekIncome: 0,
      account: account
    };
    data.characters.push(newCharacter);
    saveData();
    renderCharacterList();
    updateAllAccountSelects();
    renderStatsTable();
    showToast(`角色 "${name}" 添加成功！`);
  }

  function renderCharacterList() {
    const searchKey = searchInput.value.trim().toLowerCase();
    const filterAccount = document.getElementById('character-filter-account').value;
    let filtered = data.characters;
    if (filterAccount) {
      filtered = filtered.filter(char => char.account === filterAccount);
    }
    if (searchKey) {
      filtered = filtered.filter(char =>
        char.name.toLowerCase().includes(searchKey)
      );
    }

    if (filtered.length === 0) {
      characterListEl.innerHTML = `
        <div class="character-card">
          <div class="card-info">
            <p class="name text-gray-400">暂无角色</p>
            <p class="deposit text-gray-500">请筛选或添加新角色</p>
          </div>
        </div>
      `;
      return;
    }

    let html = '';
    filtered.forEach(char => {
      let depositStr = '';
      if (char.initialDepositUnit === 'brick') {
        depositStr = `${char.initialDeposit} 砖`;
      } else {
        depositStr = `${char.initialDeposit} 金`;
      }
      html += `
        <div class="character-card">
          <div class="card-info">
            <p class="name">${char.name}</p>
            <p class="deposit">初始存款：${depositStr}</p>
          </div>
          <button class="delete-btn" data-char-name="${char.name}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
    });
    characterListEl.innerHTML = html;
  }
  
  characterListEl.addEventListener('click', function(e) {
    if (e.target.closest('.delete-btn')) {
      const charName = e.target.closest('.delete-btn').dataset.charName;
      deleteCharacter(charName);
    }
  });

  function deleteCharacter(charName) {
    if (confirm(`确定要删除角色 "${charName}" 吗？`)) {
        // First, find the account of the character being deleted
        const characterToDelete = data.characters.find(char => char.name === charName);
        const accountName = characterToDelete ? characterToDelete.account : null;

        // Remove income records associated with the character
        data.incomeRecords = data.incomeRecords.filter(record =>
            record.character !== charName
        );
        
        // Remove the character from the main list
        data.characters = data.characters.filter(char => char.name !== charName);

        // After deletion, check if any characters are left in the same account
        if (accountName) {
            const remainingCharsInAccount = data.characters.some(char => char.account === accountName);
            
            // If no characters remain, remove the account
            if (!remainingCharsInAccount) {
                data.accounts = data.accounts.filter(acc => acc !== accountName);
                showToast(`账号 "${accountName}" 下已无角色，已自动删除。`);
            }
        }

        // Save data and refresh all relevant parts of the UI
        saveData();
        renderCharacterList();
        updateAllAccountSelects();
        renderStatsTable();
        renderRecordsTable();
    }
  }

  function formatGold(amount) {
    if (amount >= 10000) {
      return (amount / 10000).toFixed(2) + ' 砖';
    }
    return amount.toLocaleString('zh-CN') + ' 金';
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  function updateCharacterSelect() {
    const account = document.getElementById('income-account-select').value;
    charSelect.innerHTML = '<option value="">请选择角色</option>';

    // Filter characters based on the selected account
    const filteredChars = account 
        ? data.characters.filter(char => char.account === account) 
        : [];

    // Populate the character dropdown
    filteredChars.forEach(char => {
        const option = document.createElement('option');
        option.value = char.name;
        option.textContent = char.name;
        charSelect.appendChild(option);
    });

    if (account && filteredChars.length > 0) {
        const characterNamesInAccount = filteredChars.map(char => char.name);
        
        const recordsForAccount = data.incomeRecords.filter(record => 
            characterNamesInAccount.includes(record.character)
        );

        if (recordsForAccount.length > 0) {
            // Priority 1: Find the character with the most recent record in this account.
            recordsForAccount.sort((a, b) => new Date(b.date) - new Date(a.date));
            const lastCharacterUsed = recordsForAccount[0].character;
            charSelect.value = lastCharacterUsed;
        } else {
            // Priority 2: Fallback to the last character added to this account.
            const lastAddedCharInAccount = filteredChars[filteredChars.length - 1];
            charSelect.value = lastAddedCharInAccount.name;
        }
    }
  }

  function setupIncomeTypeListener() {
    setTimeout(() => {
      incomeCategory.value = '日常';
      incomeCategory.dispatchEvent(new Event('change'));
      setTimeout(() => {
        incomeSubcategory.value = '大战';
        incomeSubcategory.dispatchEvent(new Event('change'));
      }, 100);
    }, 0);

    incomeCategory.addEventListener('change', () => {
      const category = incomeCategory.value;
      incomeSubcategory.innerHTML = '<option value="">请选择子类</option>';
      if (!category) return;
      incomeTypes[category].forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        incomeSubcategory.appendChild(option);
      });
      if (category === '日常') {
        setTimeout(() => {
          incomeSubcategory.value = '大战';
          incomeSubcategory.dispatchEvent(new Event('change'));
        }, 0);
      }
    });

    incomeSubcategory.addEventListener('change', () => {
      if (incomeCategory.value === '日常' && incomeSubcategory.value === '大战') {
        incomeAmount.value = 250;
      } else {
        incomeAmount.value = '';
      }
    });
  }

  function showToast(message, isSuccess = true) {
    const toast = document.getElementById('toast');
    toast.innerHTML = '';
    toast.className = 'toast';
    const icon = document.createElement('i');
    icon.className = isSuccess ?
      'fas fa-check-circle' :
      'fas fa-exclamation-circle';
    toast.appendChild(icon);
    const textNode = document.createTextNode(message);
    toast.appendChild(textNode);
    toast.classList.add(isSuccess ? 'success' : 'error');
    toast.style.display = 'flex';
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.style.display = 'none';
      }, 300);
    }, 3000);
  }

  function convertToGold(amount, unit) {
    if (unit === 'brick') {
      return amount * 10000;
    }
    return amount;
  }

  function recordIncome(e) {
    e.preventDefault();
    const charName = charSelect.value;
    const category = incomeCategory.value;
    const subcategory = incomeSubcategory.value;
    const inputAmount = parseFloat(document.getElementById('income-amount').value);
    const unit = document.getElementById('income-unit').value;
    const amount = convertToGold(inputAmount, unit);
    const remark = document.getElementById('remark').value;

    if (!charName || !category || !subcategory || isNaN(amount) || amount <= 0) {
      showToast('请完整填写角色、收入类型和金额！', false);
      return;
    }

    if (unit === 'gold' && !Number.isInteger(inputAmount)) {
      showToast('单位为金时，金额必须为整数！', false);
      return;
    }
    if (unit === 'brick' && (inputAmount.toString().split('.')[1] || '').length > 4) {
      showToast('单位为砖时，金额最多支持四位小数！', false);
      return;
    }

    const fullType = `${category}-${subcategory}`;
    const character = data.characters.find(char => char.name === charName);
    if (character) {
      character.totalIncome += amount;
      const newRecord = {
        id: Date.now(),
        character: charName,
        category: category,
        subcategory: subcategory,
        fullType: fullType,
        amount: amount,
        remark: remark,
        date: new Date().toISOString()
      };
      data.incomeRecords.push(newRecord);
      saveData();
      incomeForm.reset();
      setDefaultIncomeSelection();
      incomeCategory.value = '日常';
      incomeCategory.dispatchEvent(new Event('change'));
      setTimeout(() => {
        incomeSubcategory.value = '大战';
        incomeSubcategory.dispatchEvent(new Event('change'));
      }, 0);
      showToast(`已成功记录 ${charName} 的 ${amount} 金 ${fullType} 收入！`);
      renderCharacterList();
      renderStatsTable();
      updateStatsTime();
      renderRecordsTable();
    } else {
      showToast('角色不存在，请重新选择！', false);
    }
  }

  function renderStatsTable() {
    // Recalculate weekly income for all characters before rendering
    const now = new Date();
    const dayOfWeek = now.getDay(); // Sunday - 0, Monday - 1, ..., Saturday - 6
    const startOfWeek = new Date(now);
    // Set to the first day of the week (Sunday)
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    data.characters.forEach(char => {
        const weekIncomes = data.incomeRecords.filter(r =>
            r.character === char.name && new Date(r.date) >= startOfWeek
        );
        char.weekIncome = weekIncomes.reduce((sum, r) => sum + r.amount, 0);
    });

    const tbody = statsTable.querySelector('tbody');
    tbody.innerHTML = '';
    const filterAccount = document.getElementById('stats-filter-account').value;
    let filteredChars = data.characters;
    if (filterAccount) {
      filteredChars = filteredChars.filter(char => char.account === filterAccount);
    }
    if (filteredChars.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-gray-400">暂无角色数据</td></tr>`;
      totalWeekIncomeEl.textContent = '-';
      totalDepositEl.textContent = '-';
      return;
    }
    const sortedChars = [...filteredChars].sort((a, b) => b.totalIncome - a.totalIncome);
    sortedChars.forEach(char => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${char.name}</td>
        <td>${formatGold(char.weekIncome || 0)}</td>
        <td>${formatGold(char.totalIncome)}</td>
      `;
      tbody.appendChild(row);
    });
    const totalWeekIncome = sortedChars.reduce((sum, char) => sum + (char.weekIncome || 0), 0);
    const totalDeposit = sortedChars.reduce((sum, char) => sum + (char.totalIncome || 0), 0);
    totalWeekIncomeEl.textContent = formatGold(totalWeekIncome);
    totalDepositEl.textContent = formatGold(totalDeposit);
  }
  
  function updateStatsTime() {
    const now = new Date();
    statsTime.textContent = now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function filterByTime(records, timeRange, startDate, endDate) {
    const now = new Date();
    let start, end;
    switch (timeRange) {
      case 'thisWeek':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 6);
        break;
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'custom':
        if (!startDate || !endDate) return records;
        start = new Date(startDate);
        end = new Date(endDate);
        break;
      default:
        return records;
    }
    return records.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= start && recordDate <= end;
    });
  }

  function renderRecordsTable() {
    const tbody = recordsTable.querySelector('tbody');
    tbody.innerHTML = '';
    const filterAccount = document.getElementById('records-filter-account').value;
    let filteredRecords = [...data.incomeRecords];
    if (filterAccount) {
      const accountChars = data.characters.filter(char => char.account === filterAccount).map(char => char.name);
      filteredRecords = filteredRecords.filter(record => accountChars.includes(record.character));
    }
    const filterChar = recordFilterCharacter.value;
    const filterType = recordFilterType.value;
    const filterTime = recordFilterTime.value;
    const startDate = customStartDate.value;
    const endDate = customEndDate.value;

    if (filterChar) {
      filteredRecords = filteredRecords.filter(record => record.character === filterChar);
    }
    if (filterType) {
      filteredRecords = filteredRecords.filter(record => (record.category + '-' + record.subcategory) === filterType);
    }
    if (filterTime !== 'all') {
      filteredRecords = filterByTime(filteredRecords, filterTime, startDate, endDate);
    }
    if (filteredRecords.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-gray-400">暂无收入记录</td></tr>`;
      recordsTotalAmount.textContent = '-';
      return;
    }
    filteredRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
    filteredRecords.forEach(record => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${record.character}</td>
        <td>${record.fullType}</td>
        <td>${formatGold(record.amount)}</td>
        <td>${record.remark || '-'}</td>
        <td>${formatDate(record.date)}</td>
      `;
      tbody.appendChild(row);
    });
    const totalAmount = filteredRecords.reduce((sum, record) => sum + record.amount, 0);
    recordsTotalAmount.textContent = formatGold(totalAmount);
  }
  
  function initNavigation() {
    navBtns.forEach(btn => {
      btn.classList.add('active');
      const tabName = btn.dataset.tab;
      panels[tabName].style.display = 'block';
    });
    updateLayout();
    navBtns.forEach(btn => {
      btn.addEventListener('click', () => toggleTab(btn.dataset.tab));
    });
  }

  function toggleTab(tabName) {
    const btn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
    btn.classList.toggle('active');
    panels[tabName].style.display = btn.classList.contains('active') ? 'block' : 'none';
    updateLayout();
  }

  function updateLayout() {
    const activePanels = Array.from(rightContent.children).filter(p => p.style.display !== 'none');
    const activeCount = activePanels.length;
    if (activeCount === 0) {
      rightContent.style.display = 'none';
      return;
    }
    rightContent.style.display = 'flex';
    if (activeCount === 2) {
      rightContent.style.flexDirection = 'row';
      activePanels.forEach(panel => {
        panel.style.flex = '1';
        panel.style.maxWidth = 'calc(50% - 12px)';
      });
    } else if (activeCount === 1) {
      rightContent.style.flexDirection = 'row';
      activePanels[0].style.flex = '1';
      activePanels[0].style.maxWidth = '100%';
    }
  }
  
  function updateAllAccountSelects() {
    const accountSelects = [
      document.getElementById('character-filter-account'),
      document.getElementById('income-account-select'),
      document.getElementById('stats-filter-account'),
      document.getElementById('records-filter-account'),
      document.getElementById('modal-char-account-select')
    ];
    accountSelects.forEach(select => {
      if (!select) return;
      const currentValue = select.value;
      select.innerHTML = `<option value="">${select.id === 'modal-char-account-select' ? '请选择账号' : '所有账号'}</option>`;
      data.accounts.forEach(account => {
        const option = document.createElement('option');
        option.value = account;
        option.textContent = account;
        select.appendChild(option);
      });
      if (currentValue && data.accounts.includes(currentValue)) {
        select.value = currentValue;
      }
    });
    updateCharacterSelect(); // Ensure character dropdown is also updated
  }
  
  function addNewAccount(accountName) {
    if (!accountName || data.accounts.includes(accountName)) {
      showToast('账号名称无效或已存在！', false);
      return;
    }
    data.accounts.push(accountName);
    saveData();
    updateAllAccountSelects();
  }
  
  function setDefaultIncomeSelection() {
    let charToSelect = null;
    let accountToSelect = null;

    if (data.incomeRecords.length > 0) {
      const lastRecord = [...data.incomeRecords].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      charToSelect = lastRecord.character;
      const charData = data.characters.find(c => c.name === charToSelect);
      if (charData) {
        accountToSelect = charData.account;
      }
    } else if (data.characters.length > 0) {
      const lastChar = data.characters[data.characters.length - 1];
      charToSelect = lastChar.name;
      accountToSelect = lastChar.account;
    }

    if (accountToSelect) {
      document.getElementById('income-account-select').value = accountToSelect;
      updateCharacterSelect();
      if (charToSelect) {
        charSelect.value = charToSelect;
      }
    }
  }

  // --------------------- 初始化调用和事件监听 ---------------------
  loadData();
  updateAllAccountSelects();
  renderCharacterList();
  renderStatsTable();
  updateStatsTime();
  renderRecordsTable();
  setupIncomeTypeListener();
  initNavigation();
  setDefaultIncomeSelection();

  // Event Listeners
  incomeForm.addEventListener('submit', recordIncome);
  characterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('char-name').value.trim();
    const deposit = parseFloat(document.getElementById('char-deposit').value);
    const unit = document.getElementById('char-deposit-unit').value;
    const account = document.getElementById('modal-char-account-select').value;
    if (!name || isNaN(deposit) || deposit < 0 || !account) {
      showToast('请完整填写角色名称、初始存款和选择一个账号！', false);
      return;
    }
    addNewCharacter(name, deposit, unit, account);
    characterModalEl.style.display = 'none';
    characterForm.reset();
  });

  recordFilterCharacter.addEventListener('change', renderRecordsTable);
  recordFilterType.addEventListener('change', renderRecordsTable);
  recordFilterTime.addEventListener('change', () => {
    customStartDate.style.display = recordFilterTime.value === 'custom' ? 'inline-block' : 'none';
    customEndDate.style.display = recordFilterTime.value === 'custom' ? 'inline-block' : 'none';
    renderRecordsTable();
  });
  customStartDate.addEventListener('change', renderRecordsTable);
  customEndDate.addEventListener('change', renderRecordsTable);
  document.getElementById('character-filter-account').addEventListener('change', renderCharacterList);
  searchInput.addEventListener('input', renderCharacterList);
  document.getElementById('stats-filter-account').addEventListener('change', renderStatsTable);
  document.getElementById('records-filter-account').addEventListener('change', renderRecordsTable);
  document.getElementById('income-account-select').addEventListener('change', updateCharacterSelect);

  addCharacterBtn.addEventListener('click', () => {
    characterModalEl.style.display = 'flex';
    document.getElementById('char-name').focus();
    updateAllAccountSelects();
  });
  closeCharModalBtn.addEventListener('click', () => {
    characterModalEl.style.display = 'none';
  });
  characterModalEl.addEventListener('click', (e) => {
    if (e.target === characterModalEl) {
      characterModalEl.style.display = 'none';
    }
  });

  addAccountBtn.addEventListener('click', () => {
    accountModalEl.style.display = 'flex';
    document.getElementById('new-account-name').focus();
  });
  closeAccountModalBtn.addEventListener('click', () => {
    accountModalEl.style.display = 'none';
  });
  accountModalEl.addEventListener('click', (e) => {
    if (e.target === accountModalEl) {
      accountModalEl.style.display = 'none';
    }
  });
  accountForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newAccountInput = document.getElementById('new-account-name');
    const newAccount = newAccountInput.value.trim();
    if (newAccount) {
      if (data.accounts.includes(newAccount)) {
        showToast('该账号已存在！', false);
      } else {
        addNewAccount(newAccount);
        document.getElementById('modal-char-account-select').value = newAccount;
        accountModalEl.style.display = 'none';
        newAccountInput.value = '';
      }
    }
  });
});