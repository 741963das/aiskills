import sqlite3

conn = sqlite3.connect('app.db')
c = conn.cursor()

print('=== 1. 检查学生用户 ===')
c.execute('SELECT id, username, email, role FROM users WHERE role="student" LIMIT 3')
students = c.fetchall()
for s in students:
    print(f'  ID={s[0]}, username={s[1]}, email={s[2]}, role={s[3]}')

if not students:
    print('  ❌ 没有找到学生用户')
    conn.close()
    exit(1)

student_id = students[0][0]

print(f'\n=== 2. 检查已发布的课程 ===')
c.execute('SELECT id, name, status, template FROM agents WHERE status="published" LIMIT 5')
published = c.fetchall()
for a in published:
    print(f'  ID={a[0]}, name={a[1][:40]}, status={a[2]}, template={a[3]}')

if not published:
    print('  ❌ 没有找到已发布的课程')
else:
    print(f'  ✅ 找到 {len(published)} 个已发布课程')

print(f'\n=== 3. 检查学生 {student_id} 已加入的课程 ===')
c.execute('SELECT id, agent_id, status, joined_at FROM student_agents WHERE student_id=?', (student_id,))
joined = c.fetchall()
for j in joined:
    print(f'  ID={j[0]}, agent_id={j[1]}, status={j[2]}, joined_at={j[3]}')

joined_agent_ids = [j[1] for j in joined if j[2] == 'active']
print(f'  已加入的课程ID (active): {joined_agent_ids}')

print(f'\n=== 4. 查找可加入的课程 ===')
if joined_agent_ids:
    placeholders = ','.join('?' * len(joined_agent_ids))
    c.execute(f'SELECT id, name, status FROM agents WHERE status="published" AND id NOT IN ({placeholders}) LIMIT 3', joined_agent_ids)
else:
    c.execute('SELECT id, name, status FROM agents WHERE status="published" LIMIT 3')

available = c.fetchall()
if available:
    print('  可以尝试加入以下课程:')
    for a in available:
        print(f'    ID={a[0]}, name={a[1][:40]}, status={a[2]}')
else:
    print('  ❌ 所有已发布课程都已加入')

print(f'\n=== 5. 检查草稿状态的课程 ===')
c.execute('SELECT id, name, status FROM agents WHERE status="draft" LIMIT 3')
drafts = c.fetchall()
if drafts:
    print('  ⚠️ 有未发布的课程（这些无法加入）:')
    for d in drafts:
        print(f'    ID={d[0]}, name={d[1][:40]}, status={d[2]}')

print('\n=== 6. 诊断结论 ===')
if not published:
    print('❌ 问题：没有已发布的课程。解决方法：教师需要先发布课程。')
elif not available:
    print('✅ 所有已发布课程已加入，无法重复加入。')
else:
    print(f'✅ 有 {len(available)} 个课程可以加入，应该可以正常加入。')

conn.close()
