import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type RootStackParamList = {
  Tabs: undefined;
  TaskDetail: { taskId: string };
  Notifications: undefined;
  Paywall: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type TabsParamList = {
  List: undefined;
  Board: undefined;
  Calendar: undefined;
  Settings: undefined;
};
