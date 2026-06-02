import AllyMark from "./AllyMark";
import { APP_NAME } from "../constants/brand";

export default function BrandWordmark({ markClassName = "", nameClassName = "" }) {
  return (
    <>
      <AllyMark className={markClassName} />
      <span className={nameClassName || undefined}>{APP_NAME}</span>
    </>
  );
}
