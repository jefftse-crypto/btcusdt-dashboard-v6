# V6 OOS Chart Visual Check Notes

已检查 `htr_v6_oos_monthly_return.png` 与 `htr_v6_train_oos_return_pf.png` 两张图表。两者均使用英文标题、坐标轴与图例，未出现中文字体乱码问题。

`htr_v6_oos_monthly_return.png` 清楚显示了 2025-06 至 2026-04 的月度净账户收益；蓝色为训练段，绿色为样本外段，红色虚线标出 OOS Start。该图显示训练段内 2025-07 为明显亏损月份，2025-09 与 2026-01 为主要正贡献月份；样本外 2026-02 与 2026-04 为负，2026-03 小幅为正。

`htr_v6_train_oos_return_pf.png` 能同时显示训练与样本外的净账户收益及 Profit Factor。当前版本的横轴顺序按字符串排序导致 OOS 位于 Train 前方；图表可读，但若追求展示习惯，后续可调整为 Train 在左、OOS 在右。
