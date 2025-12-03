import { FormBuilder } from './builder/FormBuilder';
import './index.css';

const root = document.getElementById('root');
if (root) {
    new FormBuilder(root);
}
