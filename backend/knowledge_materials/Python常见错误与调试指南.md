# Python 常见错误与调试指南

## 第一章 缩进错误（IndentationError）

### 1.1 典型错误

```python
# ❌ 错误：缩进不一致
def hello():
    print("Hello")
      print("World")   # IndentationError: unexpected indent
```

```python
# ❌ 错误：缺少缩进
if True:
print("True")   # IndentationError: expected an indented block
```

### 1.2 常见原因

1. **混用空格和 Tab**：有些编辑器会把 Tab 显示为 8 个空格，但 Python 解释器可能按 1 个 Tab 处理，导致视觉上对齐但实际不一致。
2. **复制粘贴代码**：从不同来源复制代码时，缩进风格可能不统一。
3. **块结构遗漏**：if / for / while / def / class 等后面忘记写缩进块。

### 1.3 正确做法

- 统一使用 **4 个空格**作为缩进单位（PEP 8 规范）
- 配置编辑器：按 Tab 时自动转换为 4 个空格
- 使用 VS Code / PyCharm 等专业编辑器，它们会自动处理缩进并高亮不一致的部分
- 启用编辑器的"显示空白字符"功能

### 1.4 调试方法

```python
# 方法 1：检查文件中的制表符
# 在终端运行：
# python -m tabnanny your_file.py

# 方法 2：使用 autopep8 自动修复（需要先安装）
# pip install autopep8
# autopep8 --in-place your_file.py
```

---

## 第二章 类型错误（TypeError）

### 2.1 常见类型错误类型

#### 类型一：操作数类型不兼容

```python
# ❌ 错误：字符串与数字相加
age = 20
print("年龄是：" + age)
# TypeError: can only concatenate str (not "int") to str

# ✅ 正确：先转成字符串
print("年龄是：" + str(age))
# 或使用 f-string
print(f"年龄是：{age}")
```

```python
# ❌ 错误：字符串与数字做数学运算
"100" + 5    # TypeError
"100" * "2"  # TypeError

# ✅ 正确：先做类型转换
int("100") + 5      # 105
"100" * 2            # "100100"（字符串重复）
```

#### 类型二：调用非可调用对象

```python
# ❌ 错误：把变量名写得和函数一样，覆盖了函数
len = 10        # 覆盖了内置函数 len
len("hello")    # TypeError: 'int' object is not callable

# ✅ 正确：不要覆盖内置名
str_len = 10
len("hello")    # 5
```

```python
# ❌ 错误：属性名与方法名冲突
class A:
    def __init__(self):
        self.name = "test"
    
    def name(self):    # 与属性同名！
        return self.name

a = A()
a.name()        # TypeError: 'str' object is not callable
```

#### 类型三：传参个数或类型错误

```python
def add(a, b):
    return a + b

add(1)              # TypeError: add() missing 1 required positional argument: 'b'
add(1, 2, 3)        # TypeError: add() takes 2 positional arguments but 3 were given
```

### 2.2 调试方法

```python
# 方法 1：打印类型
x = input("请输入数字：")
print(type(x))      # <class 'str'>，提醒你需要转 int

# 方法 2：断言类型
def calc_area(width, height):
    assert isinstance(width, (int, float)), "width 必须是数字"
    assert isinstance(height, (int, float)), "height 必须是数字"
    return width * height
```

---

## 第三章 索引越界（IndexError）

### 3.1 典型错误

```python
lst = [1, 2, 3]    # 索引：0, 1, 2

lst[3]              # ❌ IndexError: list index out of range
lst[-4]             # ❌ IndexError: list index out of range
```

```python
# ❌ 错误：遍历中删除元素导致索引错乱
nums = [1, 2, 3, 4, 5]
for i in range(len(nums)):
    if nums[i] % 2 == 0:
        nums.pop(i)     # 某次删除后列表变短，导致后续 i 越界
# IndexError
```

### 3.2 正确做法

```python
# 方法 1：先判断再访问
idx = 5
if idx < len(lst):
    print(lst[idx])
else:
    print("索引超出范围")

# 方法 2：遍历列表时优先用 for...in，而不是 range(len)
for item in lst:
    print(item)

# 方法 3：同时需要索引用 enumerate
for idx, item in enumerate(lst):
    print(f"第{idx}个：{item}")

# 方法 4：删除偶数元素——倒序遍历（避免索引错乱）
nums = [1, 2, 3, 4, 5]
for i in range(len(nums)-1, -1, -1):
    if nums[i] % 2 == 0:
        nums.pop(i)
# → [1, 3, 5]

# 方法 5：或者直接用列表推导式（更 Pythonic）
nums = [1, 2, 3, 4, 5]
nums = [x for x in nums if x % 2 != 0]
```

### 3.3 字符串切片的宽容性

注意：**切片操作不会报 IndexError**，但索引访问会。这是个常见的坑：

```python
s = "abc"
s[5]            # ❌ IndexError: string index out of range
s[1:100]        # ✅ 正常返回 "bc"（超出部分被忽略）
s[100:200]      # ✅ 正常返回 ""（空字符串）
```

---

## 第四章 KeyError

### 4.1 典型错误

```python
student = {"name": "张三", "age": 20}

print(student["score"])   # ❌ KeyError: 'score'
```

### 4.2 避免方法

```python
# 方法 1：使用 get() 方法，指定默认值
score = student.get("score", 0)   # 0（键不存在时返回默认值）

# 方法 2：用 in 判断键是否存在
if "score" in student:
    print(student["score"])
else:
    print("没有 score 键")

# 方法 3：使用 setdefault()（不存在就设置默认值，并返回值）
age = student.setdefault("age", 18)   # 返回 20（已存在）
score = student.setdefault("score", 60)  # 返回 60，同时 student 增加了 "score": 60

# 方法 4：使用 collections.defaultdict
from collections import defaultdict
d = defaultdict(int)   # 默认值是 0（int() 的返回值）
d["a"] += 1            # 正常执行，d["a"] 变为 1
print(d["b"])          # 0（访问不存在的键时自动创建默认值）
```

### 4.3 调试技巧

```python
d = {"name": "张三"}
try:
    print(d["age"])
except KeyError as e:
    print(f"键不存在：{e}")
    print(f"当前可用的键：{list(d.keys())}")
```

---

## 第五章 变量作用域错误

### 5.1 局部变量未初始化

```python
# ❌ 错误：条件分支不全导致变量可能未定义
def calc(option):
    if option == "add":
        result = 1 + 1
    elif option == "mul":
        result = 1 * 1
    return result   # 若 option 不是 add 或 mul，则 result 未定义 → UnboundLocalError

calc("other")
# UnboundLocalError: local variable 'result' referenced before assignment
```

✅ **解决方法**：在函数开头初始化变量
```python
def calc(option):
    result = 0
    if option == "add":
        result = 1 + 1
    elif option == "mul":
        result = 1 * 1
    return result
```

### 5.2 全局变量 vs 局部变量混淆

```python
# ❌ 错误：函数内修改全局变量但未声明
count = 0

def increment():
    count += 1      # UnboundLocalError: local variable 'count' referenced before assignment

increment()
```

✅ **解决方法**：用 global 声明
```python
count = 0

def increment():
    global count    # 声明使用全局变量
    count += 1
```

### 5.3 闭包作用域（nonlocal）

```python
# ❌ 错误：嵌套函数中修改外层函数变量未声明
def make_counter():
    count = 0
    def counter():
        count += 1   # UnboundLocalError
        return count
    return counter
```

✅ **解决方法**：用 nonlocal 声明
```python
def make_counter():
    count = 0
    def counter():
        nonlocal count   # 声明使用外层（非全局）变量
        count += 1
        return count
    return counter

c = make_counter()
print(c())    # 1
print(c())    # 2
```

---

## 第六章 可变默认参数陷阱

### 6.1 典型错误

```python
# ❌ 错误：默认参数使用可变对象
def add_student(name, students=[]):
    students.append(name)
    return students

# 预期每次调用返回新列表
print(add_student("张三"))   # ['张三']    ✔
print(add_student("李四"))   # ['张三', '李四']   ❌ 应该只包含李四！
print(add_student("王五"))   # ['张三', '李四', '王五'] ❌
```

**原因**：函数的默认参数值只在函数定义时计算**一次**，之后每次调用都共享同一个对象。

### 6.2 正确写法

```python
# ✅ 正确：用 None 作为默认值，函数内新建可变对象
def add_student(name, students=None):
    if students is None:
        students = []        # 每次调用都会创建新列表
    students.append(name)
    return students

print(add_student("张三"))   # ['张三']
print(add_student("李四"))   # ['李四']    ✔
```

### 6.3 调试验证

```python
# 查看默认参数是否被共享
def func(lst=[]):
    lst.append(1)
    print(id(lst), lst)

func()   # 12345678 [1]
func()   # 12345678 [1, 1]   ← id 相同，是同一个列表！
func()   # 12345678 [1, 1, 1]
```

---

## 第七章 编码问题

### 7.1 典型错误场景

#### 场景一：文件读写编码不匹配

```python
# Windows 默认编码是 GBK，但源文件可能是 UTF-8
# ❌ 错误：未指定编码
with open("data.txt", "w") as f:
    f.write("中文内容")     # 在某些系统上用 GBK 写入

with open("data.txt", "r") as f:
    content = f.read()       # 如果文件是 UTF-8，就会乱码或报错
```

✅ **正确做法**：始终显式指定编码
```python
with open("data.txt", "w", encoding="utf-8") as f:
    f.write("中文内容")

with open("data.txt", "r", encoding="utf-8") as f:
    content = f.read()
```

#### 场景二：print 输出编码

在 Windows 终端（特别是旧版 cmd）中，有时 print 中文会报：
```
UnicodeEncodeError: 'gbk' codec can't encode character '\ufeff'
```

解决方法：
```python
# 方法 1：设置环境变量（运行前）
# set PYTHONIOENCODING=utf-8

# 方法 2：在代码中设置标准输出编码
import sys
sys.stdout.reconfigure(encoding='utf-8')   # Python 3.7+

# 方法 3：重定向输出到文件时指定 encoding
with open("output.txt", "w", encoding="utf-8") as f:
    print("中文内容", file=f)
```

### 7.2 编码常见概念

| 概念 | 说明 |
|-----|------|
| ASCII | 只能表示英文和符号，1 字节 |
| GBK/GB2312 | 中文编码，2 字节（Windows 默认） |
| UTF-8 | 通用编码，中文 3 字节，英文 1 字节 |
| encode | str → bytes（编码） |
| decode | bytes → str（解码） |

```python
# 编码转换示例
s = "你好"

b_utf8 = s.encode("utf-8")      # b'\xe4\xbd\xa0\xe5\xa5\xbd'（6 字节）
b_gbk = s.encode("gbk")          # b'\xc4\xe3\xba\xc3'（4 字节）

b_utf8.decode("utf-8")           # "你好"
b_gbk.decode("gbk")              # "你好"
b_utf8.decode("gbk")             # ❌ 乱码：浣犲ソ（错误解码）
```

**原则**：用什么编码 encode，就用什么编码 decode。

---

## 第八章 综合调试方法

### 8.1 print 调试法

最简单也最常用的调试方法：
```python
def complex_calc(a, b, c):
    print(f"DEBUG: 输入 a={a}, b={b}, c={c}")
    result1 = a + b
    print(f"DEBUG: result1 = {result1}")
    result2 = result1 * c
    print(f"DEBUG: result2 = {result2}")
    return result2
```

**改进**：使用 f-string 的 `=` 语法（Python 3.8+）：
```python
x = 10
y = 20
print(f"{x=}, {y=}, {x+y=}")
# → x=10, y=20, x+y=30
```

### 8.2 使用 logging 模块（推荐生产环境）

```python
import logging

# 配置日志
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def divide(a, b):
    logging.debug(f"执行除法：{a} / {b}")
    try:
        result = a / b
    except ZeroDivisionError:
        logging.error("除数不能为零！")
        return None
    logging.info(f"结果：{result}")
    return result

divide(10, 0)
```

### 8.3 使用断言（assert）

```python
def divide(a, b):
    assert b != 0, "除数不能为零"  # 条件不满足时抛 AssertionError
    assert isinstance(a, (int, float)), "被除数必须是数字"
    return a / b

# 使用 -O 参数运行时会跳过所有断言（优化模式）
# python -O script.py
```

### 8.4 try-except + traceback 打印完整堆栈

```python
import traceback

def f1():
    return f2()

def f2():
    return f3()

def f3():
    return 1 / 0

try:
    f1()
except Exception as e:
    print("发生错误：", e)
    traceback.print_exc()         # 打印完整错误堆栈
```

输出示例：
```
发生错误： division by zero
Traceback (most recent call last):
  File "test.py", line 12, in <module>
    f1()
  File "test.py", line 4, in f1
    return f2()
  File "test.py", line 7, in f2
    return f3()
  File "test.py", line 10, in f3
    return 1 / 0
ZeroDivisionError: division by zero
```

### 8.5 使用 pdb 调试器

```python
import pdb

def buggy_func(x):
    result = x * 2
    pdb.set_trace()       # 在这里设置断点，程序会暂停
    result = result + x
    return result

buggy_func(5)
```

在 pdb 交互模式中常用命令：
| 命令 | 功能 |
|-----|------|
| h(elp) | 显示帮助 |
| n(ext) | 执行下一行（不进入函数） |
| s(tep) | 步入函数内部 |
| c(ontinue) | 继续运行直到下一个断点 |
| p 变量名 | 打印变量值 |
| l(ist) | 显示当前位置的代码 |
| r(eturn) | 运行到函数返回 |
| q(uit) | 退出调试器 |

### 8.6 使用 IDE 调试器（强烈推荐）

VS Code / PyCharm 等专业 IDE 提供了图形化调试器：
1. 在代码行号左边点击设置断点（红色圆点）
2. 按 F5 启动调试
3. 使用工具条：继续(F5) / 单步跳过(F10) / 单步进入(F11) / 单步跳出(Shift+F11)
4. 在左侧面板查看：变量、监视、调用堆栈

相比 print 调试，IDE 调试器的优势：
- 不用修改代码就能查看任何变量的值
- 可以在断点处动态修改变量值
- 可以设置条件断点（满足条件才暂停）
- 完整的调用堆栈可视化
