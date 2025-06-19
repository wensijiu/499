// frontend.js
console.log('测试：JavaScript 文件已加载'); // 添加这行

document.addEventListener('DOMContentLoaded', () => {
  console.log('测试：DOM 加载完成');
  
  // 其他代码...
});
// --------------------- 数据存储核心逻辑 ---------------------
const STORAGE_KEY = 'jx3IncomeTool';
let data = {
  characters: [],
  incomeRecords: []
};

// 收入类型配置
const incomeTypes = {
  "PVE": ["10人周常", "10人", "25pt", "25yx"],
  "日常": ["大战", "茶馆", "跑商"]
};

// 从 localStorage 加载数据
function loadData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    data = JSON.parse(stored);
    
    // 数据迁移：如果角色数据没有 initialDeposit 字段，添加它
    data.characters.forEach(char => {
      if (!char.hasOwnProperty('initialDeposit')) {
        char.initialDeposit = char.deposit;
        char.totalIncome = char.deposit;
      }
    });
    
    // 数据清理：移除已删除角色的收入记录
    cleanUpOrphanedRecords();
  }
}

// 清理孤立的收入记录（即关联的角色已不存在）
function cleanUpOrphanedRecords() {
  const existingCharacters = data.characters.map(char => char.name);
  
  // 过滤掉角色已不存在的记录
  const validRecords = data.incomeRecords.filter(record => 
    existingCharacters.includes(record.character)
  );
  
  // 如果有记录被删除，保存数据
  if (validRecords.length !== data.incomeRecords.length) {
    data.incomeRecords = validRecords;
    saveData();
    console.log('已清理孤立的收入记录');
  }
}

// 保存数据到 localStorage
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// --------------------- 角色管理模块 ---------------------
const characterListEl = document.getElementById('character-list');
const addCharacterBtn = document.getElementById('add-character-btn');
const characterModalEl = document.getElementById('character-modal');
const closeCharModalBtn = document.getElementById('close-char-modal');
const characterForm = document.getElementById('character-form');
const searchInput = document.getElementById('search-input');

// 添加新角色
function addNewCharacter(name, deposit, unit) {
  // 检查角色是否已存在
  if (data.characters.some(char => char.name === name)) {
    showToast('该角色已存在！', false);
    return;
  }
  // 存储单位信息，金额统一转为金
  let depositInGold = unit === 'brick' ? deposit * 10000 : deposit;
  const newCharacter = {
    name: name,
    initialDeposit: deposit, // 保留原始输入
    initialDepositUnit: unit, // 记录单位
    totalIncome: depositInGold, // 存储为金
    income: [],
    weekIncome: 0
  };
  data.characters.push(newCharacter);
  saveData();
  renderCharacterList();
  updateCharacterSelect();
  renderStatsTable();
  showToast(`角色 "${name}" 添加成功！`);
}

// 渲染角色列表（支持搜索，按添加顺序展示）
function renderCharacterList() {
  const searchKey = searchInput.value.trim().toLowerCase();
  let filtered = data.characters;
  if (searchKey) {
    filtered = data.characters.filter(char => 
      char.name.toLowerCase().includes(searchKey)
    );
  }

  if (filtered.length === 0) {
    characterListEl.innerHTML = `
      <div class="character-card">
        <div class="card-info">
          <p class="name text-gray-400">暂无角色</p>
          <p class="deposit text-gray-500">请点击"添加新角色"按钮</p>
        </div>
      </div>
    `;
    return;
  }

  let html = '';
  filtered.forEach((char, index) => {
    // 判断单位
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
        <button class="delete-btn" onclick="deleteCharacter(${index})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  });

  characterListEl.innerHTML = html;
}

// 删除角色
function deleteCharacter(index) {
  if (confirm(`确定要删除角色 "${data.characters[index].name}" 吗？`)) {
    const charName = data.characters[index].name;
    
    // 删除相关的收入记录
    data.incomeRecords = data.incomeRecords.filter(record => 
      record.character !== charName
    );
    
    // 从数据中删除角色
    data.characters.splice(index, 1);
    
    // 保存数据并刷新界面
    saveData();
    renderCharacterList();
    updateCharacterSelect();
    renderStatsTable();
    renderRecordsTable();
  }
}

// 格式化金币数字（添加千位分隔符）
function formatGold(amount) {
  if (amount >= 10000) {
    return (amount / 10000).toFixed(2) + ' 砖';
  }
  return amount.toLocaleString('zh-CN') + ' 金';
}

// 格式化日期
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

// --------------------- 收入记录模块 ---------------------
const incomePanel = document.getElementById('income-panel');
const incomeForm = document.getElementById('income-form');
const charSelect = document.getElementById('char-select');
const incomeAmount = document.getElementById('income-amount');
const incomeCategory = document.getElementById('income-category');
const incomeSubcategory = document.getElementById('income-subcategory');

// 更新角色选择下拉框（新增自动选择最近有记录的角色）
function updateCharacterSelect() {
  charSelect.innerHTML = '<option value="">请选择角色</option>';
  data.characters.forEach(char => {
    const option = document.createElement('option');
    option.value = char.name;
    option.textContent = char.name;
    charSelect.appendChild(option);
  });

  // 自动选择最近有收入记录的角色
  if (data.incomeRecords.length > 0) {
    // 按日期排序，获取最近的记录
    const sortedRecords = [...data.incomeRecords].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
    const recentCharacter = sortedRecords[0].character;
    charSelect.value = recentCharacter;
  }

  // 更新记录筛选器中的角色选择
  const recordFilterChar = document.getElementById('record-filter-character');
  recordFilterChar.innerHTML = '<option value="">所有角色</option>';
  data.characters.forEach(char => {
    const option = document.createElement('option');
    option.value = char.name;
    option.textContent = char.name;
    recordFilterChar.appendChild(option);
  });
}

// 设置收入类型选择联动（修复默认选择和自动赋值）
function setupIncomeTypeListener() {
  // 初始化默认选择（确保在 DOM 加载完成后执行）
  setTimeout(() => {
    // 选择大类：日常
    incomeCategory.value = '日常';
    // 触发 change 事件以加载子类
    incomeCategory.dispatchEvent(new Event('change'));
    
    // 延迟执行，确保子类选项已加载
    setTimeout(() => {
      // 选择子类：大战
      incomeSubcategory.value = '大战';
      // 触发 change 事件以填入金额
      incomeSubcategory.dispatchEvent(new Event('change'));
    }, 100);
  }, 0);

  // 监听大类变化，更新子类选项
  incomeCategory.addEventListener('change', () => {
    const category = incomeCategory.value;
    incomeSubcategory.innerHTML = '<option value="">请选择子类</option>';
    
    if (!category) return;
    
    // 加载对应子类选项
    incomeTypes[category].forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      incomeSubcategory.appendChild(option);
    });
    
    // 如果选择"日常"，默认选中"大战"并填入 250 金
    if (category === '日常') {
      setTimeout(() => {
        incomeSubcategory.value = '大战';
        incomeSubcategory.dispatchEvent(new Event('change'));
      }, 0);
    }
  });

  // 监听子类变化，当选择"大战"时自动填充 250 金
  incomeSubcategory.addEventListener('change', () => {
    if (incomeCategory.value === '日常' && incomeSubcategory.value === '大战') {
      incomeAmount.value = 250;
    } else {
      incomeAmount.value = '';
    }
  });
}

// 显示 Toast 弹窗
function showToast(message, isSuccess = true) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  
  // 清空内容并移除所有状态类
  toast.innerHTML = '';
  toast.className = 'toast';
  
  // 添加图标
  const icon = document.createElement('i');
  icon.className = isSuccess 
    ? 'fas fa-check-circle' 
    : 'fas fa-exclamation-circle';
  toast.appendChild(icon);
  
  // 添加消息文本
  const textNode = document.createTextNode(message);
  toast.appendChild(textNode);
  
  // 添加状态类
  toast.classList.add(isSuccess ? 'success' : 'error');
  
  // 显示并添加动画
  toast.style.display = 'flex';
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // 定时隐藏
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.style.display = 'none';
    }, 300);
  }, 3000);
}
// 单位转换函数
function convertToGold(amount, unit) {
  if (unit === 'brick') {
    return amount * 10000;
  }
  return amount;
}


// 记录新收入
function recordIncome(e) {
  e.preventDefault();
  
  const charName = charSelect.value;
  const category = incomeCategory.value;
  const subcategory = incomeSubcategory.value;
  const inputAmount = parseFloat(document.getElementById('income-amount').value); // 修改为 parseFloat
  const unit = document.getElementById('income-unit').value;
  const amount = convertToGold(inputAmount, unit);
  const remark = document.getElementById('remark').value;

  if (!charName || !category || !subcategory || isNaN(amount) || amount <= 0) {
    showToast('请完整填写角色、收入类型和金额！', false);
    return;
  }

  // 检查输入是否符合要求
  if (unit === 'gold' && !Number.isInteger(inputAmount)) {
    showToast('单位为金时，金额必须为整数！', false);
    return;
  }
  if (unit === 'brick' && (inputAmount.toString().split('.')[1] || '').length > 4) {
    showToast('单位为砖时，金额最多支持四位小数！', false);
    return;
  }

  const fullType = `${category}-${subcategory}`;

  // 查找角色并更新存款
  const character = data.characters.find(char => char.name === charName);
  if (character) {
    // 修改：不再修改 initialDeposit，只更新总收入
    character.totalIncome += amount;
    
    // 更新本周收入（假设本周是指最近7天）
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // 过滤出本周的收入记录
    const recentIncomes = character.income.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= oneWeekAgo;
    });
    
    // 计算本周总收入
    const weekTotal = recentIncomes.reduce((sum, record) => sum + record.amount, 0);
    character.weekIncome = weekTotal + amount;
    
    // 记录收入明细
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
    if (!character.income) character.income = [];
    character.income.push(newRecord);
    
    // 保存数据并刷新界面
    saveData();
    incomeForm.reset();
    // 重置为默认选择
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
// --------------------- 数据统计模块 ---------------------
const statsPanel = document.getElementById('stats-panel');
const statsTable = document.getElementById('stats-table');
const statsTime = document.getElementById('stats-time');
const totalWeekIncomeEl = document.getElementById('total-week-income');
const totalDepositEl = document.getElementById('total-deposit');

// 渲染统计表格
function renderStatsTable() {
  const tbody = statsTable.querySelector('tbody');
  tbody.innerHTML = '';
  
  if (data.characters.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center py-4 text-gray-400">暂无角色数据</td>
      </tr>
    `;
    totalWeekIncomeEl.textContent = '-';
    totalDepositEl.textContent = '-';
    return;
  }

  // 按存款排序（从高到低）
  const sortedChars = [...data.characters].sort((a, b) => b.totalIncome - a.totalIncome);

  sortedChars.forEach(char => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${char.name}</td>
      <td>${formatGold(char.weekIncome || 0)}</td>
      <td>${formatGold(char.totalIncome)}</td>
    `;
    tbody.appendChild(row);
  });

  // 计算总计
  const totalWeekIncome = sortedChars.reduce((sum, char) => sum + (char.weekIncome || 0), 0);
  const totalDeposit = sortedChars.reduce((sum, char) => sum + (char.totalIncome || 0), 0);
  
  totalWeekIncomeEl.textContent = formatGold(totalWeekIncome);
  totalDepositEl.textContent = formatGold(totalDeposit);
}

// 更新统计时间
function updateStatsTime() {
  const now = new Date();
  const timeString = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  statsTime.textContent = timeString;
}

// --------------------- 收入记录明细模块 ---------------------
const recordsTable = document.getElementById('records-table');
const recordFilterCharacter = document.getElementById('record-filter-character');
const recordFilterType = document.getElementById('record-filter-type');
const recordFilterTime = document.getElementById('record-filter-time');
const customStartDate = document.getElementById('custom-start-date');
const customEndDate = document.getElementById('custom-end-date');
const recordsTotalAmount = document.getElementById('records-total-amount');

// 根据时间范围筛选记录
function filterByTime(records, timeRange, startDate, endDate) {
  const now = new Date();
  let start;
  let end;

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

// 渲染收入记录表格
function renderRecordsTable() {
  const tbody = recordsTable.querySelector('tbody');
  tbody.innerHTML = '';
  
  if (data.incomeRecords.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4 text-gray-400">暂无收入记录</td>
      </tr>
    `;
    recordsTotalAmount.textContent = '-';
    return;
  }

  // 获取筛选条件
  const filterChar = recordFilterCharacter.value;
  const filterType = recordFilterType.value;
  const filterTime = recordFilterTime.value;
  const startDate = customStartDate.value;
  const endDate = customEndDate.value;

  // 应用筛选
  let filteredRecords = [...data.incomeRecords];
  
  if (filterChar) {
    filteredRecords = filteredRecords.filter(record => record.character === filterChar);
  }
  
  if (filterType) {
    filteredRecords = filteredRecords.filter(record => 
      (record.category + '-' + record.subcategory) === filterType
    );
  }
  
  if (filterTime) {
    filteredRecords = filterByTime(filteredRecords, filterTime, startDate, endDate);
  }

  // 按日期排序（最新的在前）
  filteredRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

  // 渲染记录
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

  // 计算总计
  const totalAmount = filteredRecords.reduce((sum, record) => sum + record.amount, 0);
  recordsTotalAmount.textContent = formatGold(totalAmount);
}

// // --------------------- 导航切换模块 ---------------------
const navBtns = document.querySelectorAll('.nav-btn');
const rightContent = document.getElementById('right-content');
const panels = {
  income: document.getElementById('income-panel'),
  stats: document.getElementById('stats-panel')
};

// 初始化导航状态
function initNavigation() {
  // 确保初始化时两个按钮都是激活状态
  navBtns.forEach(btn => {
    btn.classList.add('active');
    const tabName = btn.dataset.tab;
    panels[tabName].style.display = 'block';
  });
  
  // 调整布局
  updateLayout();
  
  // 绑定点击事件
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => toggleTab(btn.dataset.tab));
  });
}

// 切换面板显示/隐藏
function toggleTab(tabName) {
  console.log('toggleTab 函数被调用，tabName:', tabName);
  const btn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
  
  // 切换按钮激活状态
  btn.classList.toggle('active');
  
  // 显示/隐藏对应面板
  if (btn.classList.contains('active')) {
    panels[tabName].style.display = 'block';
  } else {
    panels[tabName].style.display = 'none';
  }
  
  // 更新布局
  updateLayout();
}

// 更新右侧内容区域布局
function updateLayout() {
  const activePanels = document.querySelectorAll('.right-content > .panel:not([style*="display: none"])');
  const activeCount = activePanels.length;
  
  // 处理无激活面板的情况
  if (activeCount === 0) {
    rightContent.style.display = 'none';
    return;
  }
  
  // 有激活面板时确保容器可见
  rightContent.style.display = 'flex';
  
  // 根据激活面板数量调整布局
  if (activeCount === 2) {
    rightContent.style.flexDirection = 'row';
    rightContent.style.justifyContent = 'space-between';
    rightContent.style.gap = '1.5rem'; // 24px
    
    activePanels.forEach(panel => {
      panel.style.flex = '1';
      panel.style.maxWidth = 'calc(50% - 0.75rem)'; // 减去 gap 的一半
    });
  } else if (activeCount === 1) {
    rightContent.style.flexDirection = 'row';
    rightContent.style.justifyContent = 'flex-start';
    rightContent.style.gap = '0';
    
    activePanels[0].style.flex = '1';
    activePanels[0].style.maxWidth = '100%';
  }
}
// --------------------- 初始化 ---------------------
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM 加载完成，开始初始化...');

  // 加载数据并清理孤立记录
  loadData();
  
  // 初始化角色列表
  renderCharacterList();
  updateCharacterSelect();
  
  // 设置收入类型监听
  setupIncomeTypeListener();
  
  // 初始化导航
  initNavigation();

  // 确保初始化时两个面板都显示
  navBtns.forEach(btn => {
    console.log('设置导航按钮:', btn.textContent);
    // 强制设置为激活状态
    btn.classList.add('active');
    console.log('按钮是否有 active 类:', btn.classList.contains('active'));
    // 显示对应面板
    const tabName = btn.dataset.tab;
    panels[tabName].style.display = 'block';
  });
  
  // 初始化表单提交事件
  incomeForm.addEventListener('submit', recordIncome);
  characterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('char-name').value.trim();
    const deposit = parseFloat(document.getElementById('char-deposit').value);
    const unit = document.getElementById('char-deposit-unit').value;
    if (!name || isNaN(deposit) || deposit < 0) {
      showToast('请输入有效的角色名称和初始存款！', false);
      return;
    }
    addNewCharacter(name, deposit, unit); // 传递单位
    characterModalEl.style.display = 'none';
    characterForm.reset();
  });

  // 新增：为收入记录明细筛选器添加change事件监听，实现自动筛选
  recordFilterCharacter.addEventListener('change', renderRecordsTable);
  recordFilterType.addEventListener('change', renderRecordsTable);
  recordFilterTime.addEventListener('change', () => {
    // 切换到自定义时显示日期输入框，否则隐藏
    if (recordFilterTime.value === 'custom') {
      customStartDate.style.display = 'inline-block';
      customEndDate.style.display = 'inline-block';
    } else {
      customStartDate.style.display = 'none';
      customEndDate.style.display = 'none';
    }
    renderRecordsTable();
  });
  customStartDate.addEventListener('change', renderRecordsTable);
  customEndDate.addEventListener('change', renderRecordsTable);
  
  // 初始化模态框事件
  addCharacterBtn.addEventListener('click', () => {
    characterModalEl.style.display = 'flex';
    document.getElementById('char-name').focus();
  });
  
  closeCharModalBtn.addEventListener('click', () => {
    characterModalEl.style.display = 'none';
  });
  
  // 点击模态框外部关闭模态框
  characterModalEl.addEventListener('click', (e) => {
    if (e.target === characterModalEl) {
      characterModalEl.style.display = 'none';
    }
  });
  // 调整右侧内容区域的布局
  rightContent.style.display = 'flex';
  rightContent.style.justifyContent = 'space-between';
});