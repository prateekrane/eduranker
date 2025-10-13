import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import SplashScreen from './screens/SplashScreen';
import AuthScreen from './screens/AuthScreen';
import MainScreen from './screens/Main';
import Result from './screens/Result';
import ImagePrint from './components/ImagePrint';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="SplashScreen" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="SplashScreen" component={SplashScreen} />
        <Stack.Screen name="AuthScreen" component={AuthScreen} />
        <Stack.Screen name="MainScreen" component={MainScreen} />
        <Stack.Screen name="Result" component={Result} />
        <Stack.Screen name="ImagePrint" component={ImagePrint} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
