import * as Notifications from 'expo-notifications'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export async function requestNotificationPermission() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  return finalStatus === 'granted'
}

export async function cancelHabitReminder(habitId: string) {
  // Cancela todas as notificações do hábito (podem ser várias)
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  const habitNotifications = scheduled.filter(n => 
    n.identifier.startsWith(`habit-${habitId}`)
  )
  for (const notification of habitNotifications) {
    await Notifications.cancelScheduledNotificationAsync(notification.identifier)
  }
}

export async function scheduleHabitReminder(
  habitId: string,
  habitName: string,
  icon: string,
  startHour: number,
  startMinute: number,
  frequency: 'once' | 'every_30min' | 'every_hour' | 'every_2hours' = 'once',
  endHour: number = 22
) {
  // Cancela notificações anteriores
  await cancelHabitReminder(habitId)

  if (frequency === 'once') {
    await Notifications.scheduleNotificationAsync({
      identifier: `habit-${habitId}-0`,
      content: {
        title: `${icon} Hora do teu hábito!`,
        body: `Não te esqueças: ${habitName}`,
        data: { habitId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: startHour,
        minute: startMinute,
      },
    })
    return
  }

  // Calcular intervalo em minutos
  const intervalMinutes = frequency === 'every_30min' ? 30
    : frequency === 'every_hour' ? 60
    : 120

  // Agendar notificações entre startHour e endHour
  let currentHour = startHour
  let currentMinute = startMinute
  let count = 0

  while (currentHour < endHour || (currentHour === endHour && currentMinute === 0)) {
    await Notifications.scheduleNotificationAsync({
      identifier: `habit-${habitId}-${count}`,
      content: {
        title: `${icon} Lembrete de hábito!`,
        body: `Já fizeste: ${habitName}?`,
        data: { habitId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: currentHour,
        minute: currentMinute,
      },
    })

    count++
    currentMinute += intervalMinutes
    currentHour += Math.floor(currentMinute / 60)
    currentMinute = currentMinute % 60

    // Limite de segurança
    if (count >= 20) break
  }
}

export async function sendInstantNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  })
}