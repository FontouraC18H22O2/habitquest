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

export async function scheduleHabitReminder(
  habitId: string,
  habitName: string,
  icon: string,
  hour: number,
  minute: number
) {
  await cancelHabitReminder(habitId)

  await Notifications.scheduleNotificationAsync({
    identifier: `habit-${habitId}`,
    content: {
      title: `${icon} Hora do teu hábito!`,
      body: `Não te esqueças: ${habitName}`,
      data: { habitId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  })
}

export async function cancelHabitReminder(habitId: string) {
  await Notifications.cancelScheduledNotificationAsync(`habit-${habitId}`)
}

export async function sendInstantNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  })
}