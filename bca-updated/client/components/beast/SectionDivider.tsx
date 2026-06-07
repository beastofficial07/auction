const SectionDivider = ({ flip = false }: { flip?: boolean }) => (
  <div className={`absolute ${flip ? 'bottom' : 'top'}-0 left-0 right-0 h-[1px]`} style={{
    background: 'linear-gradient(90deg, transparent 10%, hsla(45,100%,51%,0.25) 40%, hsla(45,100%,51%,0.45) 50%, hsla(45,100%,51%,0.25) 60%, transparent 90%)',
  }}/>
);
export default SectionDivider;
