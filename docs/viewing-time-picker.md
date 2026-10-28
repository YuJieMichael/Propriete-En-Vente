# Viewing time picker / Choix de l’heure des visites / 看房时间选择

In the project dashboard's personal viewing calendar, choosing a date and an available time collapses the calendar and slot grid. A compact summary retains the selected local date, time and America/Toronto time-zone label. Keyboard focus moves to “Change date and time”, which reopens the picker with the current selection intact. Choosing another day requires a new time; Clear removes both values. Existing occupied-slot and past-date checks still apply.

The selection does not save a note, confirm a viewing or send an invitation. The visitor/name field and explicit Add note submission remain required. The public property-enquiry form uses the browser's native date picker; confirming a date closes its popup and retains the form value, and the calendar button can reopen it. There are no database, lead-record or public enquiry implementation changes.

Français : après le choix d’une date et d’une heure, le calendrier se replie et un résumé reste visible. « Modifier la date et l’heure » permet de rouvrir le calendrier. L’ajout d’une note reste une action distincte, sans envoi d’invitation.

中文：用户中心看房日历选好日期和时段后自动收起，显示日期、时间和时区；可随时修改。更改日期后需重选时段，仍保留已占用时段校验。点击添加记录才会保存，不会发送邀请或自动确认看房。
