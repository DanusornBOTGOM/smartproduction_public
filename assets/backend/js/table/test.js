import { jsPDF } from 'jspdf'

const doc = new jsPDF;

doc.text("Hello world!", 10, 10);
doc.save("a4.pdf");