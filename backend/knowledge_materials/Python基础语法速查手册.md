# Python 基础语法速查手册

## 第一章 变量与数据类型

### 1.1 变量命名规则

- 变量名由字母、数字和下划线组成
- 不能以数字开头
- 区分大小写（`Name` ≠ `name`）
- 不能使用 Python 关键字（如 `if`, `for`, `while`, `class` 等）

**好的命名习惯**：
```python
student_name = "张三"       # 蛇形命名法（推荐）
max_value = 100
is_valid = True
PRIVATE_CONST = 3.14159     # 常量用全大写
```

### 1.2 Python 内置数据类型

| 类型分类 | 类型名 | 示例 | 可变性 |
|---------|-------|------|-------|
| 数值 | int | `42`, `-10`, `0x1F` | 不可变 |
| 数值 | float | `3.14`, `-0.5`, `1e5` | 不可变 |
| 数值 | complex | `1+2j`, `3j` | 不可变 |
| 布尔 | bool | `True`, `False` | 不可变 |
| 字符串 | str | `"hello"`, `'Python'` | 不可变 |
| 列表 | list | `[1, 2, 3]` | 可变 |
| 元组 | tuple | `(1, 2, 3)` | 不可变 |
| 字典 | dict | `{"name": "张三", "age": 20}` | 可变 |
| 集合 | set | `{1, 2, 3}` | 可变 |
| 空值 | NoneType | `None` | — |

### 1.3 类型转换

```python
# 显式类型转换
int("123")       # 123
float("3.14")    # 3.14
str(100)         # "100"
bool(0)          # False
bool([])         # False（空序列为假）
bool("")         # False（空字符串为假）

# 获取类型信息
type(42)                     # <class 'int'>
isinstance(42, int)          # True
isinstance("hi", (str, int)) # True（可判断多种类型）
```

### 1.4 代码示例

```python
# 多变量赋值
a, b, c = 1, 2, 3
x = y = z = 0

# 变量交换（Python 特色）
a, b = b, a

# 删除变量
x = 100
del x
```

---

## 第二章 运算符

### 2.1 算术运算符

| 运算符 | 含义 | 示例 | 结果 |
|-------|------|------|------|
| + | 加法 | `5 + 3` | 8 |
| - | 减法 | `5 - 3` | 2 |
| * | 乘法 | `5 * 3` | 15 |
| / | 除法（浮点数） | `5 / 3` | 1.666... |
| // | 整除（地板除） | `5 // 3` | 1 |
| % | 取模（余数） | `5 % 3` | 2 |
| ** | 幂运算 | `5 ** 3` | 125 |

```python
# 整除注意：向负无穷取整
7 // 3       # 2
-7 // 3      # -3（不是 -2！）

# 取模公式：a % b = a - (a // b) * b
7 % 3        # 1
-7 % 3       # 2（因为 -7 - (-3)*3 = -7+9 = 2）
```

### 2.2 比较运算符

```python
a, b = 10, 20

a == b     # 等于 → False
a != b     # 不等于 → True
a > b      # 大于 → False
a < b      # 小于 → True
a >= b     # 大于等于 → False
a <= b     # 小于等于 → True

# 链式比较（Python 特色）
x = 5
1 < x < 10        # True → 等价于 1<x and x<10
1 < x <= 5        # True
```

### 2.3 逻辑运算符

```python
# 与 and：全真为真
True and True       # True
True and False      # False

# 或 or：一真为真
True or False       # True
False or False      # False

# 非 not：取反
not True            # False
not (5 > 3)         # False

# 短路求值特点
10 / 0              # ZeroDivisionError
False and (10 / 0)  # False（不计算后面的表达式）
True or (10 / 0)    # True（不计算后面的表达式）
```

### 2.4 赋值运算符

```python
x = 10
x += 5      # x = x + 5 → 15
x -= 3      # x = x - 3 → 12
x *= 2      # x = x * 2 → 24
x /= 4      # x = x / 4 → 6.0
x //= 3     # x = x // 3 → 2.0
x %= 1      # x = x % 1 → 0.0
x **= 2     # x = x ** 2 → 0.0
```

### 2.5 位运算符（了解）

```python
a = 0b1100   # 12
b = 0b1010   # 10

a & b        # 与 → 0b1000 = 8
a | b        # 或 → 0b1110 = 14
a ^ b        # 异或 → 0b0110 = 6
~a           # 非 → -13（补码）
a << 2       # 左移 → 0b110000 = 48
a >> 2       # 右移 → 0b0011 = 3
```

### 2.6 身份运算符与成员运算符

```python
# is / is not：比较对象的内存地址
a = [1, 2, 3]
b = [1, 2, 3]
a == b       # True（值相等）
a is b       # False（不是同一个对象）
a is not b   # True

# in / not in：判断成员关系
3 in a                 # True
5 not in a             # True
"he" in "hello"        # True
"name" in {"name": "张三"}  # True（检查字典的键）
```

---

## 第三章 条件判断

### 3.1 if 语句基本结构

```python
age = 18

if age >= 18:
    print("成年人")
elif age >= 6:
    print("青少年")
else:
    print("儿童")
```

### 3.2 缩进规则

Python 使用**缩进**表示代码块（不是大括号），通常使用 4 个空格或 1 个 Tab。不要混用空格和 Tab。

```python
if True:
    print("正确缩进")  # 4 个空格
    if True:
        print("嵌套缩进")  # 8 个空格

# ❌ 错误：缩进不一致
if True:
  print("2个空格")
    print("4个空格")  # IndentationError
```

### 3.3 真值判断

Python 中的假值（Falsy）：
- `None`
- `False`
- 数值 `0`, `0.0`, `0j`
- 空序列：`""`, `[]`, `()`, `set()`, `range(0)`
- 空字典：`{}`

其他均为真值（Truthy）。

```python
lst = []
if lst:              # 等价于 if len(lst) > 0
    print("列表非空")
else:
    print("列表为空")  # 会执行这行
```

### 3.4 三元表达式（条件表达式）

```python
score = 75
result = "及格" if score >= 60 else "不及格"
print(result)   # "及格"

# 等价于：
if score >= 60:
    result = "及格"
else:
    result = "不及格"
```

### 3.5 match-case 模式匹配（Python 3.10+）

```python
status_code = 404

match status_code:
    case 200:
        print("成功")
    case 404:
        print("未找到")
    case 500:
        print("服务器错误")
    case _:           # 默认分支
        print(f"未知状态码: {status_code}")

# 带条件的模式匹配（guard）
score = 88
match score:
    case s if s >= 90:
        print("优秀")
    case s if s >= 60:
        print("及格")
    case _:
        print("不及格")
```

---

## 第四章 循环

### 4.1 for 循环

```python
# 遍历序列
fruits = ["苹果", "香蕉", "橘子"]
for fruit in fruits:
    print(f"水果：{fruit}")

# 遍历数字范围
for i in range(5):       # 0, 1, 2, 3, 4
    print(i)

for i in range(2, 7):    # 2, 3, 4, 5, 6
    print(i)

for i in range(0, 10, 2):  # 0, 2, 4, 6, 8
    print(i)

# 同时获取索引和值（enumerate）
names = ["Alice", "Bob", "Charlie"]
for idx, name in enumerate(names):
    print(f"第{idx+1}个人：{name}")
```

### 4.2 while 循环

```python
# 基本用法
count = 0
while count < 5:
    print(f"count = {count}")
    count += 1

# 无限循环（用 break 退出）
while True:
    user_input = input("输入 q 退出：")
    if user_input == 'q':
        break
```

### 4.3 break 与 continue

```python
# break：跳出整个循环
for num in [1, 3, 5, 6, 7, 9]:
    if num % 2 == 0:
        print(f"找到第一个偶数：{num}")
        break

# continue：跳过本次循环，继续下一次
for num in range(1, 11):
    if num % 3 == 0:
        continue   # 跳过 3 的倍数
    print(num)     # 1 2 4 5 7 8 10
```

### 4.4 循环中的 else 子句

```python
# for...else / while...else
# else 在循环正常结束（非 break 退出）时执行

def find_prime(n):
    for i in range(2, n):
        if n % i == 0:
            print(f"{n} 不是质数")
            break
    else:
        print(f"{n} 是质数")

find_prime(17)   # 17 是质数
find_prime(15)   # 15 不是质数
```

### 4.5 列表推导式

```python
# 基本形式：[表达式 for 变量 in 可迭代对象]
squares = [x**2 for x in range(10)]
# → [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]

# 带条件：[表达式 for 变量 in 可迭代对象 if 条件]
evens = [x for x in range(10) if x % 2 == 0]
# → [0, 2, 4, 6, 8]

# 多重循环
pairs = [(x, y) for x in [1, 2] for y in ['a', 'b']]
# → [(1,'a'), (1,'b'), (2,'a'), (2,'b')]

# 字典推导式
square_dict = {x: x**2 for x in range(5)}
# → {0: 0, 1: 1, 2: 4, 3: 9, 4: 16}

# 集合推导式
unique_chars = {c for c in "hello world"}
# → {'h', 'e', 'l', 'o', ' ', 'w', 'r', 'd'}
```

---

## 第五章 序列操作

### 5.1 列表（list）

#### 创建与访问

```python
lst = [1, "hello", 3.14, True]

# 索引（从 0 开始）
lst[0]        # 1
lst[-1]       # True（最后一个元素）

# 切片 [start:end:step]
numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
numbers[2:6]     # [2, 3, 4, 5]
numbers[:5]      # [0, 1, 2, 3, 4]
numbers[5:]      # [5, 6, 7, 8, 9]
numbers[::2]     # [0, 2, 4, 6, 8]
numbers[::-1]    # [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]（反转）
```

#### 增删改查

```python
lst = [1, 2, 3]

# 增
lst.append(4)          # 末尾追加 → [1, 2, 3, 4]
lst.insert(1, 1.5)     # 指定位置插入 → [1, 1.5, 2, 3, 4]
lst.extend([5, 6])     # 合并另一个列表 → [1, 1.5, 2, 3, 4, 5, 6]

# 删
lst.pop()              # 移除并返回末尾元素 → 6
lst.remove(1.5)        # 移除指定值 → [1, 2, 3, 4, 5]
del lst[0]             # 删除指定索引 → [2, 3, 4, 5]
lst.clear()            # 清空 → []

# 改
lst = [1, 2, 3]
lst[1] = 20            # → [1, 20, 3]
lst[1:3] = [200, 300]  # → [1, 200, 300]

# 其他操作
lst = [3, 1, 4, 1, 5, 9]
len(lst)               # 6
lst.count(1)           # 2（元素出现次数）
lst.index(4)           # 2（元素首次出现的索引）
lst.sort()             # 原地排序 → [1, 1, 3, 4, 5, 9]
lst.reverse()          # 原地反转 → [9, 5, 4, 3, 1, 1]
sorted(lst)            # 返回排序后的新列表（不修改原列表）
```

### 5.2 元组（tuple）

```python
# 创建
t = (1, 2, 3)
t2 = 1, 2, 3           # 括号可省略
single = (42,)         # 单元素元组必须有逗号
empty = ()             # 空元组

# 访问（与列表相同）
t[0]        # 1
t[1:3]      # (2, 3)

# 不可修改
t[0] = 10   # ❌ TypeError: 'tuple' object does not support item assignment

# 拆包
a, b, c = t           # a=1, b=2, c=3
a, *rest = (1,2,3,4)  # a=1, rest=[2,3,4]（* 收集剩余元素）
```

### 5.3 字符串（str）

```python
# 定义
s1 = "双引号字符串"
s2 = '单引号字符串'
s3 = '''多行
字符串'''

# 访问（不可修改）
s = "Python"
s[0]        # 'P'
s[-3:]      # 'hon'
s[0] = 'p'  # ❌ TypeError（字符串不可变）

# 常用方法
s = "Hello, World!"
s.lower()              # "hello, world!"（转小写）
s.upper()              # "HELLO, WORLD!"（转大写）
s.strip()              # 去除首尾空白
s.replace("World", "Python")  # "Hello, Python!"
s.split(",")           # ["Hello", " World!"]（分割）
",".join(["a","b","c"])# "a,b,c"（连接）
s.startswith("Hello")  # True
s.endswith("!")        # True
s.find("World")        # 7（找不到返回 -1）
s.count("l")           # 3

# f-string（格式化字符串，推荐）
name = "张三"
age = 20
f"{name}今年{age}岁"          # "张三今年20岁"
f"π ≈ {3.14159:.2f}"         # "π ≈ 3.14"（保留2位小数）
f"10的二进制：{10:#b}"        # "10的二进制：0b1010"

# 其他格式化方式
"{}今年{}岁".format(name, age)   # format 方法
"%s今年%d岁" % (name, age)       # % 格式化（旧式）
```

### 5.4 字典（dict）

```python
# 创建
student = {
    "name": "张三",
    "age": 20,
    "major": "计算机"
}

# 访问
student["name"]              # "张三"
student.get("age")           # 20
student.get("score", 0)      # 0（键不存在，返回默认值）
student["score"]             # ❌ KeyError（键不存在时报错）

# 增删改
student["score"] = 95        # 新增键值对
student["age"] = 21          # 修改已有键
del student["major"]         # 删除指定键
student.pop("score")         # 95（删除并返回值）
student.clear()              # 清空字典

# 遍历
d = {"a": 1, "b": 2, "c": 3}

for key in d:                # 遍历键
    print(key)

for value in d.values():     # 遍历值
    print(value)

for key, value in d.items(): # 遍历键值对
    print(f"{key}: {value}")

# 字典合并（Python 3.9+）
d1 = {"a": 1, "b": 2}
d2 = {"b": 20, "c": 3}
d3 = d1 | d2                 # {"a": 1, "b": 20, "c": 3}（d2 覆盖 d1）
```

### 5.5 集合（set）

```python
# 创建
s = {1, 2, 3, 2, 1}  # {1, 2, 3}（自动去重）
s2 = set([1, 2, 2, 3])
empty_set = set()    # 注意：{} 是空字典，不是空集合！

# 增删
s.add(4)             # {1, 2, 3, 4}
s.update([5, 6])     # {1, 2, 3, 4, 5, 6}
s.remove(3)          # {1, 2, 4, 5, 6}（不存在时报错）
s.discard(99)        # 不存在时不报错

# 集合运算
A = {1, 2, 3, 4}
B = {3, 4, 5, 6}

A & B          # 交集 → {3, 4}
A | B          # 并集 → {1, 2, 3, 4, 5, 6}
A - B          # 差集 → {1, 2}
A ^ B          # 对称差 → {1, 2, 5, 6}

1 in A         # True（成员判断）
A.issubset({1,2,3,4,5})   # True（子集判断）
```

---

## 第六章 函数

### 6.1 函数定义

```python
def greet(name):
    """函数文档字符串（docstring）"""
    print(f"你好，{name}！")

greet("张三")    # 你好，张三！

# 返回值
def add(a, b):
    return a + b

result = add(3, 5)   # 8

# 多个返回值（以元组形式返回）
def divide(a, b):
    quotient = a // b
    remainder = a % b
    return quotient, remainder

q, r = divide(17, 5)   # q=3, r=2
```

### 6.2 参数类型

```python
# 默认参数
def power(x, n=2):
    return x ** n

power(3)       # 9（使用默认 n=2）
power(3, 3)    # 27

# 可变位置参数 *args（收集为元组）
def sum_all(*args):
    total = 0
    for num in args:
        total += num
    return total

sum_all(1, 2, 3, 4)   # 10

# 可变关键字参数 **kwargs（收集为字典）
def print_info(**kwargs):
    for key, value in kwargs.items():
        print(f"{key}: {value}")

print_info(name="张三", age=20)
# 输出：
# name: 张三
# age: 20

# 组合使用（顺序：位置 → *args → 默认 → **kwargs）
def example(a, b, *args, c=10, **kwargs):
    print(a, b, args, c, kwargs)

example(1, 2, 3, 4, c=20, x=1, y=2)
# → 1 2 (3, 4) 20 {'x': 1, 'y': 2}

# 解包参数
lst = [1, 2, 3]
def add3(a, b, c):
    return a + b + c
add3(*lst)             # 等价于 add3(1, 2, 3) → 6

d = {"x": 1, "y": 2}
def foo(x, y):
    return x + y
foo(**d)               # 等价于 foo(x=1, y=2) → 3
```

### 6.3 可变默认参数陷阱 ⚠️

```python
# ❌ 错误：默认参数是可变对象（列表/字典/集合）
def add_item(item, lst=[]):
    lst.append(item)
    return lst

print(add_item(1))     # [1]
print(add_item(2))     # [1, 2]（不是 [2]！默认列表被共享了）
print(add_item(3))     # [1, 2, 3]

# ✅ 正确：用 None 作为默认值
def add_item(item, lst=None):
    if lst is None:
        lst = []
    lst.append(item)
    return lst

print(add_item(1))     # [1]
print(add_item(2))     # [2]（正确）
```

### 6.4 Lambda 匿名函数

```python
# 语法：lambda 参数列表: 表达式
square = lambda x: x ** 2
square(5)        # 25

# 常用场景：作为排序函数的 key
students = [("张三", 85), ("李四", 92), ("王五", 78)]
students.sort(key=lambda x: x[1], reverse=True)
# → [("李四", 92), ("张三", 85), ("王五", 78)]
```

### 6.5 作用域（LEGB 规则）

```python
x = 10           # 全局作用域（G: Global）

def outer():
    x = 20       # 闭包作用域（E: Enclosing）
    
    def inner():
        # nonlocal x    # 声明使用外层（非全局）变量
        x = 30   # 局部作用域（L: Local）
        print(x) # 30
    
    inner()
    print(x)     # 20（如果 inner 中使用了 nonlocal，则变为 30）

outer()
print(x)         # 10

# 修改全局变量需要 global 声明
def modify_global():
    global x
    x = 100

modify_global()
print(x)         # 100
```

---

## 第七章 文件读写

### 7.1 打开文件的模式

| 模式 | 说明 |
|-----|------|
| 'r' | 只读（默认） |
| 'w' | 只写（覆盖已有内容） |
| 'a' | 追加（写到文件末尾） |
| 'x' | 独占创建（文件已存在则报错） |
| 'r+' | 读写 |
| 'b' | 二进制模式（与上述组合，如 'rb'） |
| 't' | 文本模式（默认） |

### 7.2 基本操作

```python
# 写文件
f = open("test.txt", "w", encoding="utf-8")
f.write("第一行\n")
f.write("第二行\n")
f.close()    # 必须手动关闭

# ✅ 推荐：使用 with 语句（自动关闭文件）
with open("test.txt", "w", encoding="utf-8") as f:
    f.write("Hello, Python!\n")
    f.write("文件写入测试")

# 读文件
with open("test.txt", "r", encoding="utf-8") as f:
    content = f.read()        # 读取全部内容
print(content)

with open("test.txt", "r", encoding="utf-8") as f:
    for line in f:            # 逐行读取（推荐大文件）
        print(line.strip())

with open("test.txt", "r", encoding="utf-8") as f:
    lines = f.readlines()     # 读取所有行为列表
```

---

## 第八章 异常处理

### 8.1 try-except 结构

```python
try:
    num = int(input("请输入一个整数："))
    result = 10 / num
    print(f"10 / {num} = {result}")
except ValueError:
    print("错误：请输入有效的整数！")
except ZeroDivisionError:
    print("错误：除数不能为零！")
except Exception as e:
    print(f"发生未知错误：{e}")
else:
    print("程序正常运行，没有异常")
finally:
    print("无论是否异常，这里都会执行")
```

### 8.2 常见异常类型

| 异常名 | 触发场景 |
|-------|---------|
| `TypeError` | 类型错误，如 `"a" + 1` |
| `ValueError` | 值错误，如 `int("abc")` |
| `IndexError` | 索引越界，如 `lst = [1,2]; lst[5]` |
| `KeyError` | 字典键不存在，如 `d = {}; d["x"]` |
| `NameError` | 变量未定义 |
| `AttributeError` | 访问不存在的属性/方法 |
| `FileNotFoundError` | 文件不存在 |
| `ZeroDivisionError` | 除以零 |
| `IndentationError` | 缩进错误 |
| `SyntaxError` | 语法错误 |

### 8.3 主动抛出异常

```python
def register(username, password):
    if len(password) < 6:
        raise ValueError("密码长度至少为 6 位")
    # ... 注册逻辑
    return "注册成功"

try:
    register("user", "123")
except ValueError as e:
    print(e)   # "密码长度至少为 6 位"
```

### 8.4 自定义异常

```python
class InsufficientBalanceError(Exception):
    """余额不足异常"""
    def __init__(self, balance, amount):
        self.balance = balance
        self.amount = amount
        super().__init__(f"余额不足：余额 {balance}，需要 {amount}")

def withdraw(balance, amount):
    if amount > balance:
        raise InsufficientBalanceError(balance, amount)
    return balance - amount

try:
    withdraw(100, 200)
except InsufficientBalanceError as e:
    print(e)
```
