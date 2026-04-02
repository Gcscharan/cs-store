import './src/utils/sentryPolyfill';
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
// Register the headless background location task
import './src/tasks/backgroundLocationTask';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
