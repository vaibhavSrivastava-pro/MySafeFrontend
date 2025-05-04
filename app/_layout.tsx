import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import 'react-native-reanimated';
import Connect from './views/Connect';
import HomePage from './views/HomePage';

import { useColorScheme } from '@/hooks/useColorScheme';

type RootStackParamList = {
  Connect: undefined;
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();


export default function RootLayout() {

  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack.Navigator
        initialRouteName="Connect"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Connect" component={Connect} />
        <Stack.Screen name="Home" component={HomePage} />
      </Stack.Navigator>
    </ThemeProvider>
  );
}
